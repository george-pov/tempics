import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { CONFIG } from '../../config/config-token';
import type { CreateTemplateRequest } from './create-template-request';
import type { CreateTemplateResponse } from './create-template-response';
import type { TemplateListResponse } from './template-list-response';

@Injectable({ providedIn: 'root' })
export class TemplateApi {
  private readonly http = inject(HttpClient);
  private readonly config = inject(CONFIG);

  listTemplates(): Observable<TemplateListResponse> {
    return this.http.get<TemplateListResponse>(`${this.config.apiBaseUrl}/templates`);
  }

  createTemplate(request: CreateTemplateRequest): Observable<CreateTemplateResponse> {
    return this.http
      .post<CreateTemplateResponse>(`${this.config.apiBaseUrl}/templates`, request, {
        observe: 'response',
      })
      .pipe(
        map((response) => {
          const body = response.body;
          if (
            response.status !== 201 ||
            typeof body?.id !== 'string' ||
            body.id.length === 0 ||
            typeof body.name !== 'string' ||
            body.name.length === 0
          ) {
            throw new Error('Template creation was not confirmed.');
          }

          return body;
        }),
      );
  }
}
