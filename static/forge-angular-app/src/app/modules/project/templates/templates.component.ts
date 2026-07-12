import { Component, OnInit } from '@angular/core';
import { Template, TemplateScopes } from '../../../models/template.model';
import { StorageService } from '../../../services/storage.service';
import { DEFAULT_LIMITS } from '../../../models/default.limits';
import { JiraUserModel } from '../../../models/jira.user.model';
import { UtilsService } from '../../../services/utils.service';
import { StorageContext } from '../../../models/storage.context.enum';
import { DataStorageKeys } from '../../../models/data.storage.keys.model';
import { ActivatedRoute } from '@angular/router';
import { JiraService } from '../../../services/jira.service';
import { v4 as uuidv4 } from 'uuid';
import { ToastrService } from 'ngx-toastr';
import { MatDialog } from '@angular/material/dialog';
import { EditTemplateComponent } from './edit-template/edit-template.component';
import { alert, confirm } from 'basic-modals';
import { ENVIRONMENT } from '../../../environment';
import { ImportTemplateComponent } from './import-template/import-template.component';
import { AnalyticalService, ANALYTICAL_EVENTS } from 'src/app/services/analytical.service';

@Component({
  selector: 'app-templates',
  templateUrl: './templates.component.html',
  styleUrls: ['./templates.component.scss'],
})
export class TemplatesComponent implements OnInit {
  allTemplates: Template[] = [];
  projectTemplates: Template[] = [];
  personalTemplates: Template[] = [];
  globalTemplates: Template[] = [];
  projectTemplateStorageService: StorageService;
  personalTemplateStorageService: StorageService;
  globalTemplateStorageService: StorageService;
  pageLoaded = false;
  defaultLimits = DEFAULT_LIMITS;
  currentUser: JiraUserModel;
  projectIdOrKey: string;
  parentDomain = UtilsService.getParentDomain();
  filters = ['All', 'Project', 'Personal', 'Global'];
  activeFilter = 'All';
  templateScopes = TemplateScopes;
  isAdmin = false;

  constructor(private toastr: ToastrService, private route: ActivatedRoute, public dialog: MatDialog) {}

  async ngOnInit() {
    this.route.parent.params.subscribe(async (params) => {
      this.projectIdOrKey = params.id;
      this.projectTemplateStorageService = new StorageService(StorageContext.PROJECT, this.projectIdOrKey, DataStorageKeys.TEMPLATES);
      this.projectTemplates = (await this.projectTemplateStorageService.get()) || ([] as Template[]);
      this.currentUser = await JiraService.getCurrentJiraUser();

      this.personalTemplateStorageService = new StorageService(StorageContext.USER, this.currentUser.accountId, DataStorageKeys.TEMPLATES);
      this.personalTemplates = (await this.personalTemplateStorageService.get()) || ([] as Template[]);

      this.globalTemplateStorageService = new StorageService(StorageContext.APPLICATION, null, DataStorageKeys.TEMPLATES);
      this.globalTemplates = (await this.globalTemplateStorageService.get()) || ([] as Template[]);

      this.allTemplates = [...this.projectTemplates, ...this.personalTemplates, ...this.globalTemplates];
      this.allTemplates = this.allTemplates.sort(UtilsService.dynamicSort('name'));

      const fetchUserRoles = ['SYSTEM_ADMIN', 'ADMINISTER', 'ADMINISTER_PROJECTS', 'EDIT_ISSUES'];
      const responseTemplateAdminRole = ['SYSTEM_ADMIN', 'ADMINISTER', 'ADMINISTER_PROJECTS'];
      const userPermissions = await JiraService.getUserPermissions(fetchUserRoles);
      if (UtilsService.hasOneOfPermission(responseTemplateAdminRole, userPermissions)) {
        this.isAdmin = true;
      }

      AnalyticalService.sendEvent(ANALYTICAL_EVENTS.VIEW_ITEM_LIST, 'project.templates', {
        item_count: this.projectTemplates.length,
        favorite_count: this.projectTemplates.filter((t) => t.starred).length,
        project_id_or_key: this.projectIdOrKey,
      });
      AnalyticalService.sendEvent(ANALYTICAL_EVENTS.VIEW_ITEM_LIST, 'personal.templates', {
        item_count: this.personalTemplates.length,
        favorite_count: this.personalTemplates.filter((t) => t.starred).length,
      });

      this.pageLoaded = true;
      AnalyticalService.sendInstanceDetailsEvent();
    });
  }

  openImportTemplateModal() {
    const dialogRef = this.dialog.open(ImportTemplateComponent, {
      width: '600px',
      data: {
        projectIdOrKey: this.projectIdOrKey,
      },
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result) {
        for (const template of result) {
          const templateCopy = UtilsService.deepCopy(template);
          delete templateCopy.checked;
          templateCopy.id = uuidv4();
          templateCopy.updatedAt = new Date();
          templateCopy.name = `${templateCopy.name} (Imported)`;
          this.projectTemplates.push(templateCopy);
        }
        await this.projectTemplateStorageService.save(this.projectTemplates);
        this.allTemplates = [...this.projectTemplates, ...this.personalTemplates, ...this.globalTemplates];
        this.allTemplates = this.allTemplates.sort(UtilsService.dynamicSort('name'));
        AnalyticalService.sendEvent(ANALYTICAL_EVENTS.IMPORT_ITEM, 'project.templates', {});
      }
    });
  }

  openEditTemplateModal(template: Template, scope?: string): void {
    if (!template && !UtilsService.canAddTemplate(scope, this.projectTemplates, this.personalTemplates)) {
      return;
    }

    const newTemplate = !template;
    template = template || {
      id: uuidv4(),
      name: '',
      content: '',
      starred: false,
      scope,
      updatedAt: new Date(),
      updatedBy: this.currentUser,
    };
    const dialogRef = this.dialog.open(EditTemplateComponent, {
      width: '600px',
      data: {
        template: JSON.parse(JSON.stringify(template)),
        templates: scope === TemplateScopes.PROJECT ? this.projectTemplates : this.personalTemplates,
        projectIdOrKey: this.projectIdOrKey,
        isAdmin: this.isAdmin,
        newTemplate,
      },
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result) {
        let matchedIndex: number;
        if (result.scope === TemplateScopes.PERSONAL) {
          matchedIndex = this.personalTemplates.findIndex((t) => t.id === result.id);
          result.updatedAt = new Date();
          result.updatedBy = UtilsService.stripUserModel(this.currentUser);
          if (matchedIndex > -1) {
            this.personalTemplates[matchedIndex] = result;
          } else {
            this.personalTemplates.push(result);
          }
          await this.personalTemplateStorageService.save(this.personalTemplates);
          AnalyticalService.sendEvent(matchedIndex ? ANALYTICAL_EVENTS.EDIT_ITEM : ANALYTICAL_EVENTS.ADD_ITEM, 'personal.templates', {
            item_name: result.name,
            starred: result.starred,
            fields_used: UtilsService.templateContainsDollarVariables(result),
          });
          AnalyticalService.sendEvent(ANALYTICAL_EVENTS.VIEW_ITEM_LIST, 'personal.templates', {
            item_count: this.personalTemplates.length,
            favorite_count: this.personalTemplates.filter((t) => t.starred).length,
          });
        } else if (result.scope === TemplateScopes.PROJECT) {
          matchedIndex = this.projectTemplates.findIndex((t) => t.id === result.id);
          result.updatedAt = new Date();
          result.updatedBy = this.currentUser;
          if (matchedIndex > -1) {
            this.projectTemplates[matchedIndex] = result;
          } else {
            this.projectTemplates.push(result);
          }
          await this.projectTemplateStorageService.save(this.projectTemplates);
          AnalyticalService.sendEvent(matchedIndex > -1 ? ANALYTICAL_EVENTS.EDIT_ITEM : ANALYTICAL_EVENTS.ADD_ITEM, 'project.templates', {
            item_name: result.name,
            starred: result.starred,
            fields_used: UtilsService.templateContainsDollarVariables(result),
          });
          AnalyticalService.sendEvent(ANALYTICAL_EVENTS.VIEW_ITEM_LIST, 'project.templates', {
            item_count: this.projectTemplates.length,
            favorite_count: this.projectTemplates.filter((t) => t.starred).length,
            project_id_or_key: this.projectIdOrKey,
          });
        }

        this.allTemplates = [...this.projectTemplates, ...this.personalTemplates, ...this.globalTemplates];
        this.allTemplates = this.allTemplates.sort(UtilsService.dynamicSort('name'));
      }
    });
  }

  async toggleTemplateStar(template: Template) {
    template.starred = !template.starred;
    if (template.scope === TemplateScopes.PERSONAL) {
      await this.personalTemplateStorageService.save(this.personalTemplates);
      AnalyticalService.sendEvent(ANALYTICAL_EVENTS.EDIT_ITEM, 'personal.templates', {
        item_name: template.name,
        starred: template.starred,
        fields_used: UtilsService.templateContainsDollarVariables(template),
      });
    } else if (template.scope === TemplateScopes.PROJECT) {
      await this.projectTemplateStorageService.save(this.projectTemplates);
      AnalyticalService.sendEvent(ANALYTICAL_EVENTS.EDIT_ITEM, 'project.templates', {
        item_name: template.name,
        starred: template.starred,
        fields_used: UtilsService.templateContainsDollarVariables(template),
      });
    }
  }

  async deleteTemplate(template: Template) {
    if (await confirm('Are you sure?')) {
      if (template.scope === TemplateScopes.PERSONAL) {
        const index = this.personalTemplates.findIndex((t) => t.id === template.id);
        const templateToBeDelete: Template = this.personalTemplates.splice(index, 1)[0] as Template;
        await this.personalTemplateStorageService.save(this.personalTemplates);
        this.toastr.success(`${templateToBeDelete.name} deleted successfully`, `Success`);
        AnalyticalService.sendEvent(ANALYTICAL_EVENTS.DELETE_ITEM, 'personal.templates', {
          item_name: template.name,
          starred: template.starred,
          fields_used: UtilsService.templateContainsDollarVariables(template),
        });
        AnalyticalService.sendEvent(ANALYTICAL_EVENTS.VIEW_ITEM_LIST, 'personal.templates', {
          item_count: this.personalTemplates.length,
          favorite_count: this.personalTemplates.filter((t) => t.starred).length,
        });
      } else if (template.scope === TemplateScopes.PROJECT) {
        const index = this.projectTemplates.findIndex((t) => t.id === template.id);
        const templateToBeDelete: Template = this.projectTemplates.splice(index, 1)[0] as Template;
        await this.projectTemplateStorageService.save(this.projectTemplates);
        this.toastr.success(`${templateToBeDelete.name} deleted successfully`, `Success`);
        AnalyticalService.sendEvent(ANALYTICAL_EVENTS.DELETE_ITEM, 'personal.templates', {
          item_name: template.name,
          starred: template.starred,
          fields_used: UtilsService.templateContainsDollarVariables(template),
        });
        AnalyticalService.sendEvent(ANALYTICAL_EVENTS.VIEW_ITEM_LIST, 'project.templates', {
          item_count: this.projectTemplates.length,
          favorite_count: this.projectTemplates.filter((t) => t.starred).length,
          project_id_or_key: this.projectIdOrKey,
        });
      }

      this.allTemplates = [...this.projectTemplates, ...this.personalTemplates, ...this.globalTemplates];
      this.allTemplates = this.allTemplates.sort(UtilsService.dynamicSort('name'));
    }
  }

  async cloneTemplate(template: Template) {
    if (!UtilsService.canAddTemplate(template.scope, this.projectTemplates, this.personalTemplates)) {
      return;
    }

    const templateCopy = JSON.parse(JSON.stringify(template)) as Template;
    templateCopy.id = uuidv4();
    templateCopy.updatedAt = new Date();
    templateCopy.name = `Copy of ${templateCopy.name}`;
    this.openEditTemplateModal(templateCopy, templateCopy.scope);
  }
}
