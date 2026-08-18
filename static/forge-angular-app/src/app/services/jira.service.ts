import { JiraUserModel } from '../models/jira.user.model';
import { UtilsService } from './utils.service';
import { ENVIRONMENT } from '../environment';
import { DataStorageKeys } from '../models/data.storage.keys.model';
import { invoke, requestJira, showFlag as forgeShowFlag, view } from '@forge/bridge';

export class JiraService {
  static cache: any = {
    userPermissions: {},
  };

  static async request(data: any): Promise<any> {
    const payload = typeof data === 'string' ? { url: data, type: 'GET' } : data;
    return (await invoke('jiraRequest', payload)) as any;
  }

  static async getContext(): Promise<any> {
    return (await invoke('getForgeContext')) as any;
  }

  static getJiraAvatarPath(avatarUrl: string | undefined): string | undefined {
    if (!avatarUrl) {
      return undefined;
    }

    try {
      const parsedUrl = new URL(avatarUrl);
      const path = parsedUrl.pathname.replace(/^\/ex\/jira\/[^/]+/, '');
      return path.startsWith('/rest/api/3/universal_avatar/view/') ? `${path}${parsedUrl.search}` : undefined;
    } catch (e) {
      return avatarUrl.startsWith('/rest/api/3/universal_avatar/view/') ? avatarUrl : undefined;
    }
  }

  static async getAvatarObjectUrl(avatarUrl: string | undefined, projectId?: string): Promise<string | undefined> {
    const avatarPaths = [this.getJiraAvatarPath(avatarUrl), projectId ? `/rest/api/3/universal_avatar/view/type/project/owner/${projectId}?size=small` : undefined].filter(
      Boolean,
    ) as string[];

    for (const avatarPath of avatarPaths) {
      const objectUrl = await this.getAvatarObjectUrlFromPath(avatarPath);
      if (objectUrl) {
        return objectUrl;
      }
    }

    return undefined;
  }

  private static async getAvatarObjectUrlFromPath(avatarPath: string): Promise<string | undefined> {
    if (!avatarPath.startsWith('/rest/api/3/universal_avatar/view/type/project/')) {
      return undefined;
    }

    const response = await requestJira(avatarPath, {
      headers: {
        Accept: 'image/png',
      },
    });

    if (!response.ok) {
      return undefined;
    }

    return URL.createObjectURL(await response.blob());
  }

  static isInJira() {
    return true;
  }

  static async getProjectProperties(projectIdOrKey: string, properties: string[]) {
    return await invoke('getProjectProperties', {
      projectIdOrKey,
      properties,
    });
  }

  static async saveProjectProperties(projectIdOrKey: string, properties: any[]) {
    await invoke('saveProjectProperties', {
      projectIdOrKey,
      properties,
    });
  }

  static async getUserProperties(accountId: string, properties: string[]) {
    return await invoke('getUserProperties', {
      accountId,
      properties,
    });
  }

  static async saveUserProperties(accountId: string, properties: any[]) {
    await invoke('saveUserProperties', {
      accountId,
      properties,
    });
  }

  static async getTicketProperties(ticketIdOrKey: string, properties: string[]) {
    return await invoke('getIssueProperties', {
      issueIdOrKey: ticketIdOrKey,
      properties,
    });
  }

  static async saveTicketProperties(ticketIdOrKey: string, properties: any[]) {
    await invoke('saveIssueProperties', {
      issueIdOrKey: ticketIdOrKey,
      properties,
    });
  }

  /** Via the bridge, not the resolver, so Jira attributes the write to the user rather than the app. */
  private static async requestJiraAsUser(path: string, options: any = {}) {
    const response = await requestJira(path, {
      ...options,
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {}),
      },
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Jira API error ${response.status}: ${text || response.statusText}`);
    }

    return text ? UtilsService.safeParse(text) : null;
  }

  static async updateTicketDescription(ticketIdOrKey: string, description: any) {
    await this.requestJiraAsUser(`/rest/api/3/issue/${ticketIdOrKey}`, {
      method: 'PUT',
      body: JSON.stringify({ fields: { description } }),
    });
  }

  static async saveUserProperty(accountId: any, property: { key: any; value: any }) {
    await invoke('saveUserProperties', {
      accountId,
      properties: [property],
    });
  }

  static async getCurrentJiraUser(): Promise<JiraUserModel> {
    return (await invoke('getCurrentJiraUser')) as JiraUserModel;
  }

  static openJQLEditor(options: any, callback: any) {
    callback?.({ jql: options?.jql || '' });
  }

  private static flagSequence = 0;

  /** Successes auto-dismiss; warnings and errors wait to be dismissed. `close` overrides. */
  static showFlag(options: { title: string; close?: string; body: string; type: 'success' | 'info' | 'warning' | 'error' }) {
    forgeShowFlag({
      // A repeated id replaces the flag already on screen.
      id: `rt-${options.type}-${Date.now()}-${(this.flagSequence += 1)}`,
      title: options.title,
      type: options.type,
      description: options.body,
      isAutoDismiss: options.close ? options.close === 'auto' : options.type === 'success' || options.type === 'info',
    });
  }

  /** Not every module view can refresh, and the comment posted either way, so ignore a refusal. */
  static refreshIssuePage() {
    view.refresh().catch(() => undefined);
  }

  static async checkIssuesAgainstJQLs(issueIds: any[], JQLs: string[]) {
    const JQLChunk = UtilsService.sliceIntoChunks(JQLs, 10);
    const allMatches = [];
    for (const chunk of JQLChunk) {
      const response: any = await this.request({
        url: `/rest/api/3/jql/match`,
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ issueIds, jqls: chunk }),
      });
      allMatches.push(...response.matches);
    }
    return allMatches;
  }

  static resize(width: any, height: any) {
    return;
  }

  static async getApplicationProperties(properties: string[]) {
    return await invoke('getAppProperties', {
      properties,
    });
  }

  static async saveApplicationProperties(properties: any[]) {
    await invoke('saveAppProperties', {
      properties,
    });
  }

  static async getProjectSettings(projectIdOrKey: any) {
    return await invoke('getProjectSettings', {
      projectIdOrKey,
      storageKey: `${ENVIRONMENT.APP_BASE_KEY}_${DataStorageKeys.PROJECT_ADMIN_SETTINGS}`,
    });
  }

  static async getAllProjects(projectQuery?: string, maxResults?: number, startAt?: number) {
    return await invoke('getAllProjects', {
      projectQuery,
      maxResults,
      startAt,
      projectSettingsStorageKey: `${ENVIRONMENT.APP_BASE_KEY}_${DataStorageKeys.PROJECT_ADMIN_SETTINGS}`,
    });
  }

  static async saveProjectSettings(projectSettings: any, projectIdOrKey: any) {
    await invoke('saveProjectSettings', {
      projectIdOrKey,
      storageKey: `${ENVIRONMENT.APP_BASE_KEY}_${DataStorageKeys.PROJECT_ADMIN_SETTINGS}`,
      projectSettings,
    });
  }

  static async getJiraFields() {
    try {
      return await this.request({
        url: `/rest/api/3/field`,
        type: 'GET',
        contentType: 'application/json',
      });
    } catch (e) {
      return [
        {
          id: 'reporter',
          name: 'Reporter',
        },
      ];
    }
  }

  static async getIssueWithProperties(issueKey: string, properties?: string[], fields?: string[], expand?: string[]) {
    if (!issueKey) {
      return undefined;
    }

    const requestedExpand = (expand && expand.length > 0 ? expand : ['renderedFields']).join(',');
    const requestedFields = fields && fields.length > 0 ? fields.join(',') : '';
    const requestedProperties =
      properties && properties.length > 0 ? properties.map((property) => `${ENVIRONMENT.APP_BASE_KEY}-${property}`).join(',') : '';

    const queryParts = [`expand=${encodeURIComponent(requestedExpand)}`];
    if (requestedFields) {
      queryParts.push(`fields=${encodeURIComponent(requestedFields)}`);
    }
    if (requestedProperties) {
      queryParts.push(`properties=${encodeURIComponent(requestedProperties)}`);
    }

    return await this.request({
      url: `/rest/api/3/issue/${issueKey}?${queryParts.join('&')}`,
      type: 'GET',
      contentType: 'application/json',
    });
  }

  static async getProject(projectIdOrKey: string) {
    try {
      return await this.request({
        url: `/rest/api/3/project/${projectIdOrKey}`,
        type: 'GET',
        contentType: 'application/json',
      });
    } catch (e) {
      return undefined;
    }
  }

  static async addTicketComment(ticketIdOrKey: string, comment: any, properties: any[] = [], internal: boolean = false) {
    // Always sent: without it a JSM comment falls back to internal.
    const commentProperties = [
      ...properties.filter((property) => property.key !== 'sd.public.comment'),
      { key: 'sd.public.comment', value: { internal } },
    ];

    await this.requestJiraAsUser(`/rest/api/3/issue/${ticketIdOrKey}/comment`, {
      method: 'POST',
      body: JSON.stringify({ body: comment, properties: commentProperties }),
    });
  }

  static async getAllActiveUsers() {
    try {
      return this.request({
        url: `/rest/api/3/user/picker?query=.&excludeConnectUsers=true`,
        type: 'GET',
        contentType: 'application/json',
      });
    } catch (e) {
      return undefined;
    }
  }

  /** Cached per project and permission list — ADMINISTER_PROJECTS means nothing without a project. */
  static async getUserPermissions(permissions: string[], projectIdOrKey?: string) {
    const cacheKey = `${projectIdOrKey || 'global'}|${[...permissions].sort().join(',')}`;
    if (this.cache.userPermissions[cacheKey]) {
      return this.cache.userPermissions[cacheKey];
    }

    const userPermissions = await invoke('getUserPermissions', {
      permissions,
      projectIdOrKey,
    });
    this.cache.userPermissions[cacheKey] = userPermissions;
    return userPermissions;
  }
}
