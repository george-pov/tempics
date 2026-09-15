import { bootstrapApplication } from '@angular/platform-browser';
import { App } from './app';
import { createAppConfig } from './app.config';
import { loadConfig } from './shared/config/load-config';

export async function startApp(reload = () => window.location.reload()): Promise<void> {
  try {
    const config = await loadConfig();
    await bootstrapApplication(App, createAppConfig(config));
  } catch {
    const root = document.querySelector('app-root');
    if (!root) return;

    const status = document.getElementById('startup-status') ?? document.createElement('p');
    status.id = 'startup-status';
    status.setAttribute('role', 'status');
    status.textContent = 'Unable to start the app. Reload to try again.';
    const button = document.getElementById('startup-reload') ?? document.createElement('button');
    button.id = 'startup-reload';
    button.setAttribute('type', 'button');
    button.textContent = 'Reload';
    button.hidden = false;
    button.onclick = reload;
    root.replaceChildren(status, button);
  }
}
