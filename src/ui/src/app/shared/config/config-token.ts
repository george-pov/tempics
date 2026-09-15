import { InjectionToken } from '@angular/core';
import type { RuntimeConfig } from './runtime-config';

export const CONFIG = new InjectionToken<RuntimeConfig>('RuntimeConfig');
