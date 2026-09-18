import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthSession } from './auth-session';

export const signedInGuard: CanActivateFn = () =>
  inject(AuthSession).isSignedIn() || inject(Router).createUrlTree(['/']);
