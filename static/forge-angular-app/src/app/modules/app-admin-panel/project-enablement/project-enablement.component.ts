import { Component, OnInit, ViewEncapsulation } from '@angular/core';
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
export class ProjectEnablementComponent implements OnInit {
  projects: any[] = [];
  pageLoaded = false;
  searchFilter = {
    name: '',
  };
  maxResults = 50;
  UtilService = UtilsService;

  constructor() {}

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

  async updateStatus(index: number) {
    const currentProject = this.projects[index];
    await JiraService.saveProjectSettings(currentProject.adminSettings, currentProject.id);
  }
}
