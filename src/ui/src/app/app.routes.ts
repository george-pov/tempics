import { Routes } from '@angular/router';
import { AppLayout } from './layout/app-layout/app-layout';
import { signedInGuard } from './shared/auth/auth-guard';

export const routes: Routes = [
  {
    path: '',
    component: AppLayout,
    children: [
      {
        path: 'component-lab',
        title: 'Component Lab | Tempics',
        loadComponent: () =>
          import('./pages/component-lab/component-lab').then((m) => m.ComponentLab),
      },
      {
        path: '',
        pathMatch: 'full',
        title: 'Home | Tempics',
        loadComponent: () => import('./pages/home/home').then((m) => m.Home),
      },
      {
        path: 'image-generator',
        title: 'Image Generator | Tempics',
        canActivate: [signedInGuard],
        loadComponent: () =>
          import('./pages/image-generator/image-generator').then((m) => m.ImageGenerator),
      },
    ],
  },
];
