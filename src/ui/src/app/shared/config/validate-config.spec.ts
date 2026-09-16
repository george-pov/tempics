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

  it.each(['', ' ', 'key\r\ninjected-header', null, 123])(
    'rejects invalid Function key values without exposing them',
    (functionKey) => {
      expect(() => validateConfig({
        environment: 'dev',
        apiBaseUrl: 'https://dev.example.test/api',
        functionKey,
      })).toThrow('Invalid configuration shape');
    },
  );

  it.each([
    ['local', 'http://localhost:7159/api///', 'http://localhost:7159/api'],
    ['local', 'http://127.0.0.1:7159/api', 'http://127.0.0.1:7159/api'],
    ['local', 'http://[::1]:7159/api', 'http://[::1]:7159/api'],
    ['local', 'https://api.example.test/api', 'https://api.example.test/api'],
    ['dev', 'https://dev.example.test/prefix/api/', 'https://dev.example.test/prefix/api'],
    ['prod', 'https://prod.example.test/', 'https://prod.example.test'],
  ])('normalizes %s configuration', (environment, apiBaseUrl, expected) => {
    const input = { environment, apiBaseUrl };
    const config = validateConfig(input);
    expect(config).toEqual({ environment, apiBaseUrl: expected });
    expect(config).not.toBe(input);
    expect(Object.isFrozen(config)).toBe(true);
    expect(Reflect.set(config, 'apiBaseUrl', 'changed')).toBe(false);
  });

  it.each([
    null,
    [],
    'config',
    12,
    {},
    { environment: 'local' },
    { apiBaseUrl: 'https://example.test' },
    { environment: 'test', apiBaseUrl: 'https://example.test' },
    { environment: 'local', apiBaseUrl: 123 },
    { environment: 'local', apiBaseUrl: '' },
    { environment: 'local', apiBaseUrl: 'https://example.test', auth: {} },
  ])('rejects invalid shapes without exposing data', (input) => {
    expect(() => validateConfig(input)).toThrow('Invalid configuration shape');
  });

  it.each([
    '/api',
    '//example.test/api',
    'https:///example.test/api',
    ' https://example.test',
    'https://example.test/a b',
    'https://example.test\\api',
    'https://user:password@example.test',
    'https://@example.test',
    'https://example.test/api?',
    'https://example.test/api#',
    'https://example.test/?key=private',
    'ftp://example.test',
    'https://',
    'http://example.test',
    'http://localhost.example.test',
  ])('rejects ambiguous or unsafe URLs', (apiBaseUrl) => {
    expect(() => validateConfig({ environment: 'local', apiBaseUrl })).toThrow(
      'Invalid apiBaseUrl',
    );
  });

  it.each(['dev', 'prod'])('rejects loopback and HTTP in %s', (environment) => {
    for (const apiBaseUrl of [
      'http://example.test',
      'https://localhost',
      'https://LOCALHOST.',
      'https://127.0.0.1',
      'https://127.2.3.4',
      'https://127.1',
      'https://2130706433',
      'https://0x7f000001',
      'https://[0:0:0:0:0:0:0:1]',
      'https://[::ffff:127.0.0.1]',
    ]) {
      expect(() => validateConfig({ environment, apiBaseUrl })).toThrow('Invalid apiBaseUrl');
    }
    expect(validateConfig({ environment, apiBaseUrl: 'https://127.example.test' })).toBeDefined();
  });
});
