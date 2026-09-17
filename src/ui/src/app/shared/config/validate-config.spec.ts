import { validateConfig } from './validate-config';

describe('validateConfig', () => {
  it('preserves the optional Function key in frozen runtime settings', () => {
    const config = validateConfig({
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
    const input = { environment, apiBaseUrl };
    const config = validateConfig(input);
    expect(config).toEqual({ environment, apiBaseUrl: expected });
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
    expect(() => validateConfig({ environment: 'local', apiBaseUrl })).toThrow(
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
      expect(() => validateConfig({ environment, apiBaseUrl })).toThrow('Invalid apiBaseUrl');
    }
    expect(validateConfig({ environment, apiBaseUrl: 'https://127.example.test' })).toBeDefined();
  });
});
