import { Injectable } from '@angular/core';
import { view } from '@forge/bridge';

@Injectable({
  providedIn: 'root',
})
export class ForgeContextService {
  // Fails during local Angular-only runs, where there is no Forge context to read.
  async getContext(): Promise<any | null> {
    try {
      return await view.getContext();
    } catch {
      return null;
    }
  }

  async createHistory(): Promise<any | null> {
    try {
      const createHistory = (view as any)?.createHistory;
      if (typeof createHistory !== 'function') {
        return null;
      }

      return await createHistory();
    } catch {
      return null;
    }
  }
}
