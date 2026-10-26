import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { CONFIG } from '../../config/config-token';
import type { TemplateListResponse } from './template-list-response';

@Injectable({ providedIn: 'root' })
export class TemplateApi {
  private readonly http = inject(HttpClient);
  private readonly config = inject(CONFIG);

  listTemplates(): Observable<TemplateListResponse> {
    return this.http.get<TemplateListResponse>(`${this.config.apiBaseUrl}/templates`);
  }
}
