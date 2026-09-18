import { inject, InjectionToken } from '@angular/core';
import { IPublicClientApplication, PublicClientApplication } from '@azure/msal-browser';
import { CONFIG } from '../config/config-token';

export const AUTH_CLIENT = new InjectionToken<IPublicClientApplication>('AUTH_CLIENT', {
  providedIn: 'root',
  factory: () => {
    const { auth } = inject(CONFIG);
    if (new URL(auth.redirectUri).origin !== window.location.origin) {
      throw new Error('Authentication redirect must match this application origin');
    }
    return new PublicClientApplication({
      auth: {
        clientId: auth.clientId,
        authority: auth.authority,
        knownAuthorities: [new URL(auth.authority).hostname],
        redirectUri: auth.redirectUri,
        postLogoutRedirectUri: auth.postLogoutRedirectUri,
      },
      cache: { cacheLocation: 'sessionStorage' },
      system: { loggerOptions: { piiLoggingEnabled: false, loggerCallback: () => {} } },
    });
  },
});
