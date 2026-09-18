import { validateConfig } from './validate-config';
import { CONFIG_FIXTURE } from './config-fixture';

describe('validateConfig', () => {
  it('preserves the optional Function key in frozen runtime settings', () => {
    const config = validateConfig({
      ...CONFIG_FIXTURE,
      environment: 'dev',
      apiBaseUrl: 'https://dev.example.test/api/',
      functionKey: 'fixture-function-key==',
    });
    expect(config.apiBaseUrl).toBe('https://dev.example.test/api');
    expect(config.functionKey).toBe('fixture-function-key==');
    expect(Object.isFrozen(config)).toBe(true);
  });

  it.each([
    { name: 'empty', value: '' },
    { name: 'header injection', value: 'key\r\ninjected-header' },
    { name: 'wrong type', value: 123 },
  ])('rejects a Function key with $name', ({ value: functionKey }) => {
    expect(() =>
      validateConfig({
        ...CONFIG_FIXTURE,
        environment: 'dev',
        apiBaseUrl: 'https://dev.example.test/api',
        functionKey,
      }),
    ).toThrow('Invalid configuration shape');
  });

  it.each([
    ['local', 'http://localhost:7159/api///', 'http://localhost:7159/api'],
    ['local', 'http://127.0.0.1:7159/api', 'http://127.0.0.1:7159/api'],
    ['local', 'http://[::1]:7159/api', 'http://[::1]:7159/api'],
    ['dev', 'https://dev.example.test/prefix/api/', 'https://dev.example.test/prefix/api'],
  ])('normalizes %s configuration at %s', (environment, apiBaseUrl, expected) => {
    const input = { ...CONFIG_FIXTURE, environment, apiBaseUrl };
    const config = validateConfig(input);
    expect(config).toEqual({ ...CONFIG_FIXTURE, environment, apiBaseUrl: expected });
    expect(config).not.toBe(input);
    expect(Object.isFrozen(config)).toBe(true);
    expect(Reflect.set(config, 'apiBaseUrl', 'changed')).toBe(false);
  });

  it.each([
    null,
    { environment: 'local' },
    { apiBaseUrl: 'https://example.test' },
    { environment: 'test', apiBaseUrl: 'https://example.test' },
    { environment: 'local', apiBaseUrl: 123 },
    { environment: 'local', apiBaseUrl: '' },
    { environment: 'local', apiBaseUrl: 'https://example.test', auth: {} },
  ])('rejects invalid configuration shape: %j', (input) => {
    expect(() => validateConfig(input)).toThrow('Invalid configuration shape');
  });

  it.each([
    '/api',
    'https:///example.test/api',
    ' https://example.test',
    'https://example.test\\api',
    'https://user:password@example.test',
    'https://example.test/?key=private',
    'https://',
    'http://example.test',
  ])('rejects an ambiguous or unsafe URL: %s', (apiBaseUrl) => {
    expect(() => validateConfig({ ...CONFIG_FIXTURE, environment: 'local', apiBaseUrl })).toThrow(
      'Invalid apiBaseUrl',
    );
  });

  it.each(['dev', 'prod'])('rejects loopback and HTTP in %s', (environment) => {
    for (const apiBaseUrl of [
      'http://example.test',
      'https://localhost',
      'https://127.0.0.1',
      'https://[::1]',
      'https://[::ffff:127.0.0.1]',
    ]) {
      expect(() => validateConfig({ ...CONFIG_FIXTURE, environment, apiBaseUrl })).toThrow(
        'Invalid apiBaseUrl',
      );
    }
    expect(
      validateConfig({ ...CONFIG_FIXTURE, environment, apiBaseUrl: 'https://127.example.test' }),
    ).toBeDefined();
  });

  it('freezes the authentication settings and scopes', () => {
    const config = validateConfig(CONFIG_FIXTURE);
    expect(Object.isFrozen(config.auth)).toBe(true);
    expect(Object.isFrozen(config.auth.apiScopes)).toBe(true);
  });

  it.each([
    { clientId: 'invalid' },
    { clientSecret: 'must-not-be-in-a-browser' },
    { apiScopes: [] },
    { apiScopes: ['openid'] },
    { apiScopes: ['api://example-api/Images.Render\r\ninvalid'] },
    { authority: 'http://tenant.example.test/' },
    { authority: 'https://user:password@tenant.example.test/' },
    { authority: 'https:///tenant.example.test/' },
    { redirectUri: 'https://ui.example.test/other-page' },
    { postLogoutRedirectUri: 'https://other.example.test/' },
    { redirectUri: 'https://ui.example.test/#token' },
  ])('rejects unsafe authentication settings: %j', (auth) => {
    expect(() =>
      validateConfig({ ...CONFIG_FIXTURE, auth: { ...CONFIG_FIXTURE.auth, ...auth } }),
    ).toThrow();
  });
});
