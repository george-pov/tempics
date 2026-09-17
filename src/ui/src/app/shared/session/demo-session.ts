import { Injectable, signal } from '@angular/core';

// Presentation state only. This does not authenticate a user or authorize API access.
@Injectable({ providedIn: 'root' })
export class DemoSession {
  private readonly signedIn = signal(false);
  readonly isSignedIn = this.signedIn.asReadonly();

  signIn(): void {
    this.signedIn.set(true);
  }

  signOut(): void {
    this.signedIn.set(false);
  }
}
