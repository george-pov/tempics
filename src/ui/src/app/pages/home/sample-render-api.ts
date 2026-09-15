import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { CONFIG } from '../../shared/config/config-token';

@Injectable({ providedIn: 'root' })
export class SampleRenderApi {
  private readonly http = inject(HttpClient);
  private readonly config = inject(CONFIG);

  renderSample(): Observable<Blob> {
    return this.http.post(`${this.config.apiBaseUrl}/renders/sample`, null, {
      responseType: 'blob',
    });
  }
}
