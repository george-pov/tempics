import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Icon } from '../../../shared/components/icon/icon';
import { LabExample } from '../shared/lab-example/lab-example';
import { LabPage } from '../shared/lab-page/lab-page';

@Component({
  selector: 'app-icon-lab',
  imports: [Icon, LabExample, LabPage],
  templateUrl: './icon-lab.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IconLab {}
