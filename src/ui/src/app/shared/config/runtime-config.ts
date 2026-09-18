export interface RuntimeConfig {
  readonly environment: 'local' | 'dev' | 'prod';
  readonly apiBaseUrl: string;
  readonly auth: {
    readonly clientId: string;
    readonly authority: string;
    readonly redirectUri: string;
    readonly postLogoutRedirectUri: string;
    readonly apiScopes: readonly string[];
  };
}
