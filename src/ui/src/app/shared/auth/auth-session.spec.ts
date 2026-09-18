import { TestBed } from '@angular/core/testing';
import { AccountInfo, InteractionRequiredAuthError } from '@azure/msal-browser';
import { CONFIG } from '../config/config-token';
import { CONFIG_FIXTURE } from '../config/config-fixture';
import { AUTH_CLIENT } from './auth-client';
import { AuthSession } from './auth-session';

describe('AuthSession', () => {
  const account = { homeAccountId: 'fixture-account' } as AccountInfo;
  let active: AccountInfo | null;
  let client: ReturnType<typeof createClient>;
  let session: AuthSession;

  function createClient() {
    return {
      initialize: vi.fn().mockResolvedValue(undefined),
      handleRedirectPromise: vi.fn().mockResolvedValue(null),
      getActiveAccount: vi.fn(() => active),
      getAllAccounts: vi.fn(() => [] as AccountInfo[]),
      setActiveAccount: vi.fn((value: AccountInfo | null) => (active = value)),
      loginRedirect: vi.fn().mockResolvedValue(undefined),
      logoutRedirect: vi.fn().mockResolvedValue(undefined),
      acquireTokenSilent: vi
        .fn()
        .mockResolvedValue({ accessToken: 'api-access-token', idToken: 'id-token' }),
      acquireTokenRedirect: vi.fn().mockResolvedValue(undefined),
    };
  }

  beforeEach(() => {
    active = null;
    client = createClient();
    TestBed.configureTestingModule({
      providers: [
        { provide: AUTH_CLIENT, useValue: client },
        { provide: CONFIG, useValue: CONFIG_FIXTURE },
      ],
    });
    session = TestBed.inject(AuthSession);
  });

  it('completes a redirect before exposing a signed-in session', async () => {
    let complete!: (value: { account: AccountInfo }) => void;
    client.handleRedirectPromise.mockReturnValue(new Promise((resolve) => (complete = resolve)));
    const ready = session.initialize();
    expect(session.isSignedIn()).toBe(false);
    await Promise.resolve();
    complete({ account });
    await ready;
    expect(active).toBe(account);
    expect(session.isSignedIn()).toBe(true);
    expect(client.handleRedirectPromise).toHaveBeenCalledWith({ navigateToLoginRequestUrl: false });
  });

  it('restores the cached session after a reload without starting a new sign-in', async () => {
    client.getAllAccounts.mockReturnValue([account]);
    await session.initialize();
    expect(session.isSignedIn()).toBe(true);
    expect(client.loginRedirect).not.toHaveBeenCalled();
  });

  it('shows safe retry feedback when sign-in is cancelled or denied', async () => {
    client.handleRedirectPromise.mockRejectedValue(new Error('private identity details'));
    await session.initialize();
    expect(session.isSignedIn()).toBe(false);
    expect(session.errorMessage()).toContain('try again');
    expect(session.errorMessage()).not.toContain('private');
  });

  it('requests the API scope at sign-in and prevents repeated clicks', async () => {
    let complete!: () => void;
    client.loginRedirect.mockReturnValue(new Promise<void>((resolve) => (complete = resolve)));
    const pending = session.signIn();
    await session.signIn();
    expect(client.loginRedirect).toHaveBeenCalledExactlyOnceWith({
      scopes: CONFIG_FIXTURE.auth.apiScopes,
    });
    expect(session.isBusy()).toBe(true);
    expect(session.isSignedIn()).toBe(false);
    complete();
    await pending;
  });

  it('allows retry after the sign-in window cannot be opened', async () => {
    client.loginRedirect.mockRejectedValue(new Error('private provider detail'));
    await session.signIn();
    expect(session.isBusy()).toBe(false);
    expect(session.errorMessage()).toContain('try again');
  });

  it('acquires an API access token for the active account, never the ID token', async () => {
    active = account;
    expect(await session.acquireApiToken()).toBe('api-access-token');
    expect(client.acquireTokenSilent).toHaveBeenCalledWith({
      account,
      scopes: CONFIG_FIXTURE.auth.apiScopes,
    });
  });

  it('rejects signed-out calls and empty access tokens', async () => {
    await expect(session.acquireApiToken()).rejects.toThrow('Sign in');
    expect(client.acquireTokenSilent).not.toHaveBeenCalled();
    active = account;
    client.acquireTokenSilent.mockResolvedValue({
      accessToken: '',
      idToken: 'not-an-access-token',
    });
    await expect(session.acquireApiToken()).rejects.toThrow('No API access token');
  });

  it('redirects once when renewal needs interaction and does not release an unauthenticated call', async () => {
    active = account;
    client.acquireTokenSilent.mockRejectedValue(new InteractionRequiredAuthError());
    const receive = vi.fn();
    void session.acquireApiToken().then(receive);
    await vi.waitFor(() => expect(client.acquireTokenRedirect).toHaveBeenCalledOnce());
    expect(receive).not.toHaveBeenCalled();
    await expect(session.acquireApiToken()).rejects.toThrow('Sign in');
    expect(client.acquireTokenRedirect).toHaveBeenCalledOnce();
  });

  it('passes failures through without an automatic retry or redirect loop', async () => {
    active = account;
    client.acquireTokenSilent.mockRejectedValue(new Error('network failure'));
    await expect(session.acquireApiToken()).rejects.toThrow('network failure');
    expect(client.acquireTokenRedirect).not.toHaveBeenCalled();
  });

  it('starts only one redirect when concurrent token requests need interaction', async () => {
    active = account;
    client.acquireTokenSilent.mockRejectedValue(new InteractionRequiredAuthError());
    void session.acquireApiToken();
    await expect(session.acquireApiToken()).rejects.toBeInstanceOf(InteractionRequiredAuthError);
    expect(client.acquireTokenRedirect).toHaveBeenCalledOnce();
  });

  it('ends the provider session for the active account on sign-out', async () => {
    active = account;
    await session.initialize();
    await session.signOut();
    expect(client.logoutRedirect).toHaveBeenCalledWith({ account });
    expect(session.isSignedIn()).toBe(false);
  });
});
