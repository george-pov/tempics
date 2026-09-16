export interface RuntimeConfig {
  readonly environment: 'local' | 'dev' | 'prod';
  readonly apiBaseUrl: string;
  readonly functionKey?: string;
}
