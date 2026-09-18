import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { CONFIG } from './shared/config/config-token';
import type { RuntimeConfig } from './shared/config/runtime-config';
import { AuthSession } from './shared/auth/auth-session';
import { bearerInterceptor } from './shared/auth/bearer-interceptor';

export function createAppConfig(config: RuntimeConfig): ApplicationConfig {
  return {
    providers: [
      provideBrowserGlobalErrorListeners(),
      provideRouter(routes),
      provideHttpClient(withInterceptors([bearerInterceptor])),
      { provide: CONFIG, useValue: config },
      provideAppInitializer(() => inject(AuthSession).initialize()),
    ],
  };
}
