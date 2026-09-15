import type { RuntimeConfig } from './runtime-config';
import { validateConfig } from './validate-config';

export async function loadConfig(): Promise<RuntimeConfig> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(new URL('config.json', document.baseURI), {
      cache: 'no-store',
      redirect: 'error',
      signal: controller.signal,
    });
    const contentType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
    if (!response.ok || contentType !== 'application/json') {
      throw new Error('Configuration response unavailable');
    }
    const value: unknown = await response.json();
    return validateConfig(value);
  } catch {
    throw new Error('Configuration loading failed');
  } finally {
    clearTimeout(timeout);
  }
}
