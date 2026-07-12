import { Component, OnInit, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { DataStorageKeys } from 'src/app/models/data.storage.keys.model';
import { StorageContext } from 'src/app/models/storage.context.enum';
import { Template } from 'src/app/models/template.model';
import { StorageService } from 'src/app/services/storage.service';
import { JiraService } from '../../../../services/jira.service';

@Component({
  selector: 'app-import-template',
  templateUrl: './import-template.component.html',
  styleUrls: ['./import-template.component.scss'],
})
export class ImportTemplateComponent implements OnInit {
  projects: any[] = [];
  pageLoaded = false;
  maxResults = 50;
  selectedProject: any = null;
  projectTemplates: Template[];
  selectedTemplates: Template[] = [];
  loadingTemplates = false;
  projectIdOrKey: string;
  constructor(private dialogRef: MatDialogRef<ImportTemplateComponent>, @Inject(MAT_DIALOG_DATA) public dataFromPatent: any) {
    dialogRef.disableClose = true;
    this.projectIdOrKey = dataFromPatent.projectIdOrKey;
  }

  async ngOnInit() {
    let response: any = { isLast: false, values: [] };
    while (!response.isLast) {
      response = await JiraService.getAllProjects('', this.maxResults, this.projects.length);
      this.projects.push(...response.values);
      this.projects = this.projects.filter((p) => p.id !== this.projectIdOrKey);
    }
    this.pageLoaded = true;
  }

  async loadTemplates() {
    this.projectTemplates = [];
    this.loadingTemplates = true;
    const projectTemplateStorageService = new StorageService(StorageContext.PROJECT, this.selectedProject.id, DataStorageKeys.TEMPLATES);
    this.projectTemplates = (await projectTemplateStorageService.get()) || ([] as Template[]);
    this.projectTemplates.map((t) => (t['checked'] = false));
    this.loadingTemplates = false;
  }

  cancelEditing() {
    this.dialogRef.close();
  }

  async clickOk() {
    this.dialogRef.close(this.projectTemplates.filter((t) => t['checked']));
  }
}
