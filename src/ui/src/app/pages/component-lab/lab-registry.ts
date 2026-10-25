import { Type } from '@angular/core';
import { ButtonLab } from './button-lab/button-lab';
import { ButtonLinkLab } from './button-link-lab/button-link-lab';
import { IconLab } from './icon-lab/icon-lab';
import { InputLab } from './input-lab/input-lab';
import { AlertLab } from './alert-lab/alert-lab';
import { ProgressBarLab } from './progress-bar-lab/progress-bar-lab';

export interface ComponentLabItem {
  readonly label: string;
  readonly component: Type<unknown>;
}

export const componentLabItems: readonly ComponentLabItem[] = [
  { label: 'Button', component: ButtonLab },
  { label: 'Button Link', component: ButtonLinkLab },
  { label: 'Icon', component: IconLab },
  { label: 'Input', component: InputLab },
  { label: 'Alert', component: AlertLab },
  { label: 'Progress Bar', component: ProgressBarLab },
];
