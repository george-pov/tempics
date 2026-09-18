import { inject, Injectable, signal } from '@angular/core';
import { InteractionRequiredAuthError } from '@azure/msal-browser';
import { CONFIG } from '../config/config-token';
import { AUTH_CLIENT } from './auth-client';

@Injectable({ providedIn: 'root' })
export class AuthSession {
  private readonly client = inject(AUTH_CLIENT);
  private readonly config = inject(CONFIG).auth;
  private readonly signedIn = signal(false);
  private readonly busy = signal(false);
  private readonly error = signal('');

  readonly isSignedIn = this.signedIn.asReadonly();
  readonly isBusy = this.busy.asReadonly();
  readonly errorMessage = this.error.asReadonly();

  async initialize(): Promise<void> {
    await this.client.initialize();
    try {
      const result = await this.client.handleRedirectPromise({ navigateToLoginRequestUrl: false });
      const account =
        result?.account ??
        this.client.getActiveAccount() ??
        this.client.getAllAccounts()[0] ??
        null;
      this.client.setActiveAccount(account);
      this.signedIn.set(account !== null);
    } catch {
      this.client.setActiveAccount(null);
      this.signedIn.set(false);
      this.error.set('Sign-in was not completed. Please try again.');
    }
  }

  async signIn(): Promise<void> {
    if (this.isBusy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.client.loginRedirect({ scopes: [...this.config.apiScopes] });
    } catch {
      this.error.set('Could not open sign-in. Please try again.');
    } finally {
      this.busy.set(false);
    }
  }

  async signOut(): Promise<void> {
    if (this.isBusy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.client.logoutRedirect({ account: this.client.getActiveAccount() ?? undefined });
      this.signedIn.set(false);
    } catch {
      this.error.set('Could not sign out. Please try again.');
    } finally {
      this.busy.set(false);
    }
  }

  async acquireApiToken(): Promise<string> {
    const account = this.client.getActiveAccount();
    if (!account || this.isBusy()) throw new Error('Sign in before rendering an image');
    const request = { account, scopes: [...this.config.apiScopes] };
    try {
      const result = await this.client.acquireTokenSilent(request);
      if (!result.accessToken) throw new Error('No API access token was returned');
      return result.accessToken;
    } catch (error) {
      if (!(error instanceof InteractionRequiredAuthError)) throw error;
      if (this.isBusy()) throw error;
      this.busy.set(true);
      try {
        await this.client.acquireTokenRedirect(request);
        // Navigation replaces this page. Do not send a request without a token.
        return await new Promise<string>(() => {});
      } catch (redirectError) {
        this.busy.set(false);
        throw redirectError;
      }
    }
  }
}
