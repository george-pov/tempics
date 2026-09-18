import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap } from 'rxjs';
import { CONFIG } from '../config/config-token';
import { AuthSession } from './auth-session';

export const bearerInterceptor: HttpInterceptorFn = (request, next) => {
  const base = new URL(inject(CONFIG).apiBaseUrl);
  const target = new URL(request.url, window.location.origin);
  const prefix = base.pathname.replace(/\/+$/, '');
  if (
    target.origin !== base.origin ||
    !(target.pathname === prefix || target.pathname.startsWith(`${prefix}/`))
  ) {
    return next(request);
  }

  return from(inject(AuthSession).acquireApiToken()).pipe(
    switchMap((token) => next(request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }))),
  );
};
