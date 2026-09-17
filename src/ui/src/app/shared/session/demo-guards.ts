import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { DemoSession } from './demo-session';

export const signedInGuard: CanActivateFn = () =>
  inject(DemoSession).isSignedIn() || inject(Router).createUrlTree(['/']);

export const homeGuard: CanActivateFn = () =>
  inject(DemoSession).isSignedIn() ? inject(Router).createUrlTree(['/image-generator']) : true;
