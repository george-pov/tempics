import { Validator } from '@cfworker/json-schema';
import type { Schema } from '@cfworker/json-schema';
import schema from './config.schema.json' with { type: 'json' };
import type { RuntimeConfig } from './runtime-config';

const validator = new Validator(schema as Schema, '7');

export function validateConfig(value: unknown): RuntimeConfig {
  if (!validator.validate(value).valid) {
    throw new Error('Invalid configuration shape');
  }

  const { environment, apiBaseUrl, auth } = value as RuntimeConfig;
  const authority = configUrl(auth.authority, false);
  const redirect = configUrl(auth.redirectUri, environment === 'local');
  const logout = configUrl(auth.postLogoutRedirectUri, environment === 'local');
  if (redirect.origin !== logout.origin || redirect.pathname !== '/' || logout.pathname !== '/') {
    throw new Error('Auth redirects must use the application home URL');
  }
  // URL accepts some ambiguous spellings; reject them before canonicalization.
  if (!/^https?:\/\//i.test(apiBaseUrl) || /[\s\\?#]/u.test(apiBaseUrl)) {
    throw new Error('Invalid apiBaseUrl');
  }

  let url: URL;
  try {
    url = new URL(apiBaseUrl);
  } catch {
    throw new Error('Invalid apiBaseUrl');
  }

  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  const loopback =
    host === 'localhost' ||
    host === '[::1]' ||
    /^127(?:\.\d{1,3}){3}$/.test(host) ||
    /^\[::ffff:7f[0-9a-f]{2}:/.test(host);
  const localHttp =
    environment === 'local' && (host === 'localhost' || host === '127.0.0.1' || host === '[::1]');
  const apiAuthority = apiBaseUrl.slice(apiBaseUrl.indexOf('//') + 2).split('/')[0];
  if (
    !apiAuthority ||
    !url.hostname ||
    apiAuthority.includes('@') ||
    url.username ||
    url.password ||
    (url.protocol !== 'https:' && !(url.protocol === 'http:' && localHttp)) ||
    (environment !== 'local' && loopback)
  ) {
    throw new Error('Invalid apiBaseUrl');
  }

  return Object.freeze({
    environment,
    apiBaseUrl: url.href.replace(/\/+$/, ''),
    auth: Object.freeze({
      ...auth,
      authority: authority.href.replace(/\/+$/, ''),
      redirectUri: redirect.href,
      postLogoutRedirectUri: logout.href,
      apiScopes: Object.freeze([...auth.apiScopes]),
    }),
  });
}

function configUrl(value: string, allowLocal: boolean): URL {
  if (!/^https?:\/\/[^/]/i.test(value) || /[\s\\?#@]/u.test(value)) {
    throw new Error('Invalid authentication URL');
  }
  const url = new URL(value);
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(allowLocal && loopback && url.protocol === 'http:')) {
    throw new Error('Invalid authentication URL');
  }
  return url;
}
