import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ButtonLink } from '../../../shared/components/button-link/button-link';
import { LabExample } from '../shared/lab-example/lab-example';
import { LabPage } from '../shared/lab-page/lab-page';

@Component({
  selector: 'app-button-link-lab',
  imports: [ButtonLink, LabExample, LabPage],
  templateUrl: './button-link-lab.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ButtonLinkLab {}
