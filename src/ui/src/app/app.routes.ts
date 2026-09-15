import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'component-lab',
    title: 'Component Lab | Tempics',
    loadComponent: () =>
      import('./pages/component-lab/component-lab').then((m) => m.ComponentLab),
  },
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./pages/home/home').then((m) => m.Home),
  },
];
