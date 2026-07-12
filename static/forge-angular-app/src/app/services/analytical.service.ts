import { ENVIRONMENT } from '../environment';
import { JiraService } from './jira.service';
import { UtilsService } from './utils.service';

export class AnalyticalService {
  static user: any = null;
  static isAnalyticsEnabled() {
    const hostname = window.location.hostname;
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0';
    return ENVIRONMENT.ANALYTICS_ENABLED && !isLocalhost && Array.isArray(window['dataLayer']);
  }

  static async sendEvent(event: string, component: string, parameters: any) {
    if (AnalyticalService.isAnalyticsEnabled()) {
      if (!AnalyticalService.user) {
        AnalyticalService.user = await JiraService.getCurrentJiraUser();
      }
      const domain = UtilsService.getParentDomain();
      const eventToPush = Object.assign(
        { user_id: AnalyticalService.user.accountId, customer: domain, paid: ENVIRONMENT.PAID_VERSION, event, component },
        parameters,
      );
      // @ts-ignore
      window.dataLayer.push(eventToPush);
    }
  }

  static async sendInstanceDetailsEvent() {
    if (AnalyticalService.isAnalyticsEnabled()) {
      if (!AnalyticalService.user) {
        AnalyticalService.user = await JiraService.getCurrentJiraUser();
      }
      const domain = UtilsService.getParentDomain();
      const response = await JiraService.getAllActiveUsers();
      const eventToPush = {
        user_id: AnalyticalService.user.accountId,
        customer: domain,
        paid: ENVIRONMENT.PAID_VERSION,
        event: ANALYTICAL_EVENTS.INSTANCE_DETAILS,
        component: 'instance',
        item_count: response ? response.total : 0,
      };
      // @ts-ignore
      window.dataLayer.push(eventToPush);
    }
  }
}

export const ANALYTICAL_EVENTS = {
  VIEW_ITEM_LIST: 'view_item_list',
  VIEW_ITEM: 'view_item',
  ADD_ITEM: 'add_item',
  IMPORT_ITEM: 'import_item',
  DELETE_ITEM: 'delete_item',
  EDIT_ITEM: 'edit_item',
  SELECT_ITEM: 'select_item',
  SAVE_ITEM: 'save_item',
  CANCEL_ITEM: 'cancel_item',
  INSTANCE_DETAILS: 'instance_details',
};
