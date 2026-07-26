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
  UtilService = UtilsService;
  private avatarObjectUrls: string[] = [];

  constructor(private sanitizer: DomSanitizer) {}

  async ngOnInit() {
    let response: any = { isLast: false, values: [] };
    while (!response.isLast) {
      response = await JiraService.getAllProjects('', this.maxResults, this.projects.length);
      this.projects.push(...response.values);
    }
    for (const project of this.projects) {
      if (!project.properties[`${ENVIRONMENT.APP_BASE_KEY}_${DataStorageKeys.PROJECT_ADMIN_SETTINGS}`]) {
        project.properties[`${ENVIRONMENT.APP_BASE_KEY}_${DataStorageKeys.PROJECT_ADMIN_SETTINGS}`] =
          UtilsService.deepCopy(DefaultProjectAdminSettings);
      }
      project.adminSettings = project.properties[`${ENVIRONMENT.APP_BASE_KEY}_${DataStorageKeys.PROJECT_ADMIN_SETTINGS}`];
    }
    this.pageLoaded = true;
  }

  async updateStatus(project: any) {
    // Takes the project itself: the row index comes from the search-filtered list, so it pointed
    // at the wrong entry of `projects` whenever a search was active.
    await JiraService.saveProjectSettings(project.adminSettings, project.id);
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
