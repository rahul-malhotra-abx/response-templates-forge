import {Component, OnInit} from '@angular/core';
import {JiraService} from '../../../services/jira.service';
import {ENVIRONMENT} from '../../../environment';
import {DataStorageKeys} from '../../../models/data.storage.keys.model';
import {ActivatedRoute} from '@angular/router';
import {StorageService} from '../../../services/storage.service';
import {StorageContext} from '../../../models/storage.context.enum';
import {DefaultProjectAdminSettings, ProjectAdminSetting} from '../../../models/default.project.admin.settings.model';
import {confirm} from 'basic-modals';

@Component({
  selector: 'app-settings',
  templateUrl: './project-settings.component.html',
  styleUrls: ['./project-settings.component.scss']
})
export class ProjectSettingsComponent implements OnInit {

  projectIdOrKey: any;
  projectSettings: ProjectAdminSetting;
  ENVIRONMENT = ENVIRONMENT;

  constructor(private route: ActivatedRoute) {
  }

  async ngOnInit() {
    this.projectIdOrKey = this.route.parent.params['value'].id;
    const storageSettings = await JiraService.getProjectSettings(this.projectIdOrKey) || {};
    this.projectSettings = Object.assign(DefaultProjectAdminSettings, storageSettings);
  }

}
