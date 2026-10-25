import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ProgressBar } from '../../../shared/components/progress-bar/progress-bar';
import { LabExample } from '../shared/lab-example/lab-example';
import { LabPage } from '../shared/lab-page/lab-page';

@Component({
  selector: 'app-progress-bar-lab',
  imports: [ProgressBar, LabExample, LabPage],
  templateUrl: './progress-bar-lab.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProgressBarLab {}
