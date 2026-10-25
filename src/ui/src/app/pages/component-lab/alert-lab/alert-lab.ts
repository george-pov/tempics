import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Alert } from '../../../shared/components/alert/alert';
import { LabExample } from '../shared/lab-example/lab-example';
import { LabPage } from '../shared/lab-page/lab-page';

@Component({
  selector: 'app-alert-lab',
  imports: [Alert, LabExample, LabPage],
  templateUrl: './alert-lab.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlertLab {}
