import { RuntimeConfig } from './runtime-config';

// Reserved public values for tests; never used by application providers.
export const CONFIG_FIXTURE: RuntimeConfig = {
  environment: 'local',
  apiBaseUrl: 'http://localhost:7159/api',
  auth: {
    clientId: '11111111-1111-1111-1111-111111111111',
    authority: 'https://tenant.example.test/tenant/v2.0',
    redirectUri: 'https://ui.example.test/',
    postLogoutRedirectUri: 'https://ui.example.test/',
    apiScopes: ['api://example-api/Images.Render'],
  },
};
