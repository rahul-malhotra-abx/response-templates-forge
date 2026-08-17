import { StorageContext } from '../models/storage.context.enum';
import { ENVIRONMENT } from '../environment';
import { JiraService } from './jira.service';
import { UtilsService } from './utils.service';

export class StorageService {
  storageBaseKey: string;
  storageContext: StorageContext;
  referenceKey: string;
  singleKeyCharacterLimit = 25000;

  constructor(storageContext: StorageContext, referenceKey: string, storageBaseKey: string) {
    this.storageContext = storageContext;
    this.storageBaseKey = ENVIRONMENT.APP_BASE_KEY + '-' + storageBaseKey;
    this.referenceKey = referenceKey;
  }

  async save(data: {}) {
    let dataArray;
    const stringData = JSON.stringify(data);
    if (stringData?.length >= this.singleKeyCharacterLimit) {
      dataArray = stringData.match(/.{1,25000}/g);
      dataArray = dataArray || [''];
    } else {
      dataArray = [data];
    }
    const propertiesArray = [];
    for (const [index, chunk] of dataArray.entries()) {
      const property = {
        key: `${this.storageBaseKey}_${index}`,
        value: {
          data: chunk,
          totalSize: dataArray.length,
          current: index,
        },
      };
      propertiesArray.push(property);
    }
    try {
      if (this.storageContext === StorageContext.PROJECT) {
        await JiraService.saveProjectProperties(this.referenceKey, propertiesArray);
      } else if (this.storageContext === StorageContext.USER) {
        await JiraService.saveUserProperties(this.referenceKey, propertiesArray);
      } else if (this.storageContext === StorageContext.TICKET) {
        await JiraService.saveTicketProperties(this.referenceKey, propertiesArray);
      } else if (this.storageContext === StorageContext.APPLICATION) {
        await JiraService.saveApplicationProperties(propertiesArray);
      }
    } catch (e) {
      // Writes now run as the user, so Jira itself rejects anyone without rights on the target, and
      // the resolver rejects anyone whose licence has lapsed. Say which it was instead of letting a
      // bare API error surface.
      const message = `${e?.['message'] || e}`;
      let body = 'Could not save your changes. Please try again.';
      if (/licence|license/i.test(message)) {
        body = 'Your Response Templates for Jira licence is not active, so changes cannot be saved.';
      } else if (/\b40[13]\b|administrator rights/i.test(message)) {
        body = 'You do not have permission to change these templates. Project templates need project administrator rights.';
      }

      JiraService.showFlag({ title: 'Save failed', body, type: 'error' });
      throw e;
    }
  }

  private async fetch(propertyKeys: string[]): Promise<any> {
    if (this.storageContext === StorageContext.PROJECT) {
      return await JiraService.getProjectProperties(this.referenceKey, propertyKeys);
    } else if (this.storageContext === StorageContext.USER) {
      return await JiraService.getUserProperties(this.referenceKey, propertyKeys);
    } else if (this.storageContext === StorageContext.TICKET) {
      return await JiraService.getTicketProperties(this.referenceKey, propertyKeys);
    } else if (this.storageContext === StorageContext.APPLICATION) {
      return await JiraService.getApplicationProperties(propertyKeys);
    }
    return undefined;
  }

  async get(): Promise<any> {
    // Every chunk carries `totalSize`, so reading the first one says how many others exist. Asking
    // blind for a fixed 15 cost a request per key — and for app properties another request against
    // the legacy Connect store for each of the keys Forge did not hold, which is most of them.
    const firstKey = `${this.storageBaseKey}_0`;
    const firstResponse = await this.fetch([firstKey]);

    const firstChunk = firstResponse?.[firstKey];
    const parsedFirstChunk = typeof firstChunk === 'string' ? UtilsService.safeParse(firstChunk) : firstChunk;
    // Capped at the 100 properties an app may hold, so a corrupt `totalSize` cannot spin here.
    const totalSize = Math.min(parsedFirstChunk?.totalSize || 0, 100);

    let propertyArrayResponse = firstResponse;
    if (totalSize > 1) {
      const remainingKeys = [...Array(totalSize - 1).keys()].map((i) => `${this.storageBaseKey}_${i + 1}`);
      propertyArrayResponse = { ...firstResponse, ...(await this.fetch(remainingKeys)) };
    }

    return UtilsService.mergeJiraDataKeys(propertyArrayResponse, this.storageBaseKey);
  }
}
