import { Type } from '@angular/core';
import { ButtonLab } from './button-lab/button-lab';

export interface ComponentLabItem {
  readonly label: string;
  readonly component: Type<unknown>;
}

export const componentLabItems: readonly ComponentLabItem[] = [
  { label: 'Button', component: ButtonLab },
];
