import { Component, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { JiraService } from '../../../services/jira.service';
import { ENVIRONMENT } from '../../../environment';
import { DataStorageKeys } from '../../../models/data.storage.keys.model';
import { DefaultProjectAdminSettings } from '../../../models/default.project.admin.settings.model';
import { UtilsService } from '../../../services/utils.service';

@Component({
  selector: 'app-project-enablement',
  templateUrl: './project-enablement.component.html',
  styleUrls: ['./project-enablement.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class ProjectEnablementComponent implements OnInit, OnDestroy {
  projects: any[] = [];
  pageLoaded = false;
  searchFilter = {
    name: '',
  };
  maxResults = 50;
  defaultEnabled = true;
  appliedDefault = true;
  UtilService = UtilsService;
  private avatarObjectUrls: string[] = [];

  constructor(private sanitizer: DomSanitizer) {}

  async ngOnInit() {
    let response: any = { isLast: false, values: [] };
    while (!response.isLast) {
      response = await JiraService.getAllProjects('', this.maxResults, this.projects.length);
      this.projects.push(...response.values);
    }
    this.defaultEnabled = (await JiraService.getDefaultProjectEnabled())?.enabled !== false;
    this.appliedDefault = this.defaultEnabled;

    for (const project of this.projects) {
      const stored = project.properties[`${ENVIRONMENT.APP_BASE_KEY}_${DataStorageKeys.PROJECT_ADMIN_SETTINGS}`];
      project.adminSettings = stored || UtilsService.deepCopy(DefaultProjectAdminSettings);
      // No stored flag means the project follows the global default rather than being enabled outright.
      project.status =
        typeof stored?.responseTemplatesEnabled === 'boolean' ? (stored.responseTemplatesEnabled ? 'enabled' : 'disabled') : 'default';
      project.appliedStatus = project.status;
    }
    this.pageLoaded = true;
  }

  async updateStatus(project: any) {
    const settings = { ...project.adminSettings, version: project.adminSettings?.version ?? DefaultProjectAdminSettings.version };
    if (project.status === 'default') {
      delete settings.responseTemplatesEnabled;
    } else {
      settings.responseTemplatesEnabled = project.status === 'enabled';
    }

    try {
      await JiraService.saveProjectSettings(settings, project.id);
      project.adminSettings = settings;
      project.appliedStatus = project.status;
      JiraService.showFlag({
        title: this.statusLabel(project.status),
        body:
          project.status === 'default'
            ? `${project.name} now follows the default for new projects.`
            : `Response Templates ${project.status === 'enabled' ? 'enabled for' : 'disabled for'} ${project.name}.`,
        type: 'success',
      });
    } catch (e) {
      // The write runs as the signed-in user, so put the dropdown back if Jira refused it.
      project.status = project.appliedStatus;
      JiraService.showFlag({
        title: 'Save failed',
        body: `Could not update ${project.name}. Jira administrator rights are required.`,
        type: 'error',
      });
    }
  }

  async updateDefault() {
    try {
      await JiraService.setDefaultProjectEnabled(this.defaultEnabled);
      this.appliedDefault = this.defaultEnabled;
      JiraService.showFlag({
        title: 'Default updated',
        body: `Projects without their own setting are now ${this.defaultEnabled ? 'enabled' : 'disabled'}.`,
        type: 'success',
      });
    } catch (e) {
      this.defaultEnabled = this.appliedDefault;
      JiraService.showFlag({
        title: 'Save failed',
        body: 'Jira administrator rights are required to change the default.',
        type: 'error',
      });
    }
  }

  statusLabel(status: string) {
    if (status === 'default') {
      return `Default [${this.defaultEnabled ? 'Enabled' : 'Disabled'}]`;
    }
    return status === 'enabled' ? 'Enabled' : 'Disabled';
  }

  ngOnDestroy() {
    this.avatarObjectUrls.forEach((objectUrl) => URL.revokeObjectURL(objectUrl));
  }

  async loadProjectAvatarFallback(project: any) {
    if (project.avatarFallbackLoading) {
      return;
    }
    if (project.avatarObjectUrl) {
      project.avatarUnavailable = true;
      return;
    }

    project.avatarFallbackLoading = true;
    try {
      const objectUrl = await JiraService.getAvatarObjectUrl(project?.avatarUrls?.['24x24'], project?.id);
      if (objectUrl) {
        project.avatarObjectUrl = this.sanitizer.bypassSecurityTrustUrl(objectUrl);
        this.avatarObjectUrls.push(objectUrl);
      } else {
        project.avatarUnavailable = true;
      }
    } catch (e) {
      project.avatarUnavailable = true;
    } finally {
      project.avatarFallbackLoading = false;
    }
  }

  getProjectAvatarInitials(project: any): string {
    const value = project?.key || project?.name || '?';
    return value.slice(0, 2).toUpperCase();
  }
}
