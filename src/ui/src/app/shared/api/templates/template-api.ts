import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { CONFIG } from '../../config/config-token';
import type { TemplateDetail } from './template-detail';
import type { TemplateListResponse } from './template-list-response';
import type { TemplateSummary } from './template-summary';

@Injectable({ providedIn: 'root' })
export class TemplateApi {
  private readonly http = inject(HttpClient);
  private readonly config = inject(CONFIG);

  listTemplates(): Observable<TemplateListResponse> {
    return this.http.get<TemplateListResponse>(`${this.config.apiBaseUrl}/templates`);
  }

  getTemplate(id: string): Observable<TemplateDetail> {
    return this.http.get<TemplateDetail>(
      `${this.config.apiBaseUrl}/templates/${encodeURIComponent(id)}`,
    );
  }

  createTemplate(request: Pick<TemplateDetail, 'name' | 'template'>): Observable<TemplateSummary> {
    return this.http
      .post<TemplateSummary>(
        `${this.config.apiBaseUrl}/templates`,
        {
          name: request.name,
          template: request.template,
        },
        {
          observe: 'response',
        },
      )
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

  updateTemplate(id: string, request: Pick<TemplateDetail, 'name' | 'template'>): Observable<void> {
    return this.http
      .put(
        `${this.config.apiBaseUrl}/templates/${encodeURIComponent(id)}`,
        {
          name: request.name,
          template: request.template,
        },
        {
          responseType: 'text',
        },
      )
      .pipe(map(() => undefined));
  }

  deleteTemplate(id: string): Observable<void> {
    return this.http
      .delete(`${this.config.apiBaseUrl}/templates/${encodeURIComponent(id)}`, {
        responseType: 'text',
      })
      .pipe(map(() => undefined));
  }
}
