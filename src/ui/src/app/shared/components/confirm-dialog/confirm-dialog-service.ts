import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { NavigationStart, Router } from '@angular/router';
import { filter, map, Observable, takeUntil, tap } from 'rxjs';
import { ConfirmDialog } from './confirm-dialog';
import type { ConfirmDialogData, ConfirmDialogOptions } from './confirm-dialog-options';

let nextDialogId = 0;

@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  private readonly dialog = inject(MatDialog);
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);

  confirm(options: ConfirmDialogOptions): Observable<boolean> {
    const invoker = this.document.activeElement;
    const id = `app-confirm-dialog-${++nextDialogId}`;
    const titleId = `${id}-title`;
    const messageId = `${id}-message`;
    const data: ConfirmDialogData = { options, titleId, messageId };
    const dialogRef = this.dialog.open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, {
      data,
      ariaLabelledBy: titleId,
      ariaDescribedBy: messageId,
      autoFocus: '.cancel button',
      restoreFocus: false,
      closeOnNavigation: true,
      width: '28rem',
      maxWidth: 'calc(100vw - 2rem)',
      enterAnimationDuration: 0,
      exitAnimationDuration: 0,
    });

    let navigating = false;
    const navigation = this.router.events
      .pipe(
        filter((event) => event instanceof NavigationStart),
        takeUntil(dialogRef.afterClosed()),
      )
      .subscribe(() => {
        navigating = true;
        dialogRef.close(false);
      });

    return dialogRef.afterClosed().pipe(
      tap(() => {
        navigation.unsubscribe();
        if (!navigating && invoker instanceof HTMLElement && invoker.isConnected) {
          invoker.focus();
        }
      }),
      map((result) => result === true),
    );
  }
}
