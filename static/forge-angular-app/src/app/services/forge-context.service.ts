import { Injectable } from '@angular/core';
import { view } from '@forge/bridge';

@Injectable({
  providedIn: 'root',
})
export class ForgeContextService {
  // Reads Forge extension context when the app is running inside Forge Custom UI.
  // During local Angular-only runs this call may fail, so we safely return null.
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
