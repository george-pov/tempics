import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { CONFIG } from '../../config/config-token';

@Injectable({ providedIn: 'root' })
export class ImageRenderApi {
  private readonly http = inject(HttpClient);
  private readonly config = inject(CONFIG);

  renderSample(): Observable<Blob> {
    return this.http.post(`${this.config.apiBaseUrl}/renders/sample`, null, {
      responseType: 'blob',
      headers: this.config.functionKey ? { 'x-functions-key': this.config.functionKey } : undefined,
    });
  }
}
