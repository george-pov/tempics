export interface ConfirmDialogOptions {
  readonly title: string;
  readonly message: string;
  readonly confirmLabel: string;
  readonly cancelLabel: string;
  readonly intent: 'normal' | 'destructive';
}

export interface ConfirmDialogData {
  readonly options: ConfirmDialogOptions;
  readonly titleId: string;
  readonly messageId: string;
}
