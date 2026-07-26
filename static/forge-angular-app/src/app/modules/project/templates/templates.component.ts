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

  /**
   * Templates are re-read from storage before every write. The lists loaded with the page go stale
   * as soon as anything is created elsewhere (another tab, an issue view, another admin), which let
   * duplicate names through and made each save overwrite whatever had been added since.
   */
  private async loadTemplatesForScope(scope: string): Promise<Template[]> {
    const storageService = scope === TemplateScopes.PERSONAL ? this.personalTemplateStorageService : this.projectTemplateStorageService;
    return ((await storageService?.get()) || []) as Template[];
  }

  private async saveTemplatesForScope(scope: string, templates: Template[]) {
    if (scope === TemplateScopes.PERSONAL) {
      this.personalTemplates = templates;
      await this.personalTemplateStorageService.save(templates);
    } else {
      this.projectTemplates = templates;
      await this.projectTemplateStorageService.save(templates);
    }
    this.refreshAllTemplates();
  }

  private refreshAllTemplates() {
    this.allTemplates = [...this.projectTemplates, ...this.personalTemplates, ...this.globalTemplates].sort(UtilsService.dynamicSort('name'));
  }

  private static isNameTaken(templates: Template[], name: string, templateId: string) {
    const comparableName = (name || '').trim().toLowerCase();
    return templates.some((template) => template.id !== templateId && (template.name || '').trim().toLowerCase() === comparableName);
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
        const currentTemplates = await this.loadTemplatesForScope(TemplateScopes.PROJECT);
        for (const template of result) {
          const templateCopy = UtilsService.deepCopy(template);
          delete templateCopy.checked;
          templateCopy.id = uuidv4();
          templateCopy.updatedAt = new Date();
          templateCopy.name = `${templateCopy.name} (Imported)`;
          currentTemplates.push(templateCopy);
        }
        await this.saveTemplatesForScope(TemplateScopes.PROJECT, currentTemplates);
        AnalyticalService.sendEvent(ANALYTICAL_EVENTS.IMPORT_ITEM, 'project.templates', {});
      }
    });
  }

  async openEditTemplateModal(template: Template, scope?: string): Promise<void> {
    const targetScope = template?.scope || scope;
    const projectTemplates = await this.loadTemplatesForScope(TemplateScopes.PROJECT);
    const personalTemplates = await this.loadTemplatesForScope(TemplateScopes.PERSONAL);

    if (!template && !UtilsService.canAddTemplate(scope, projectTemplates, personalTemplates)) {
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
        templates: targetScope === TemplateScopes.PROJECT ? projectTemplates : personalTemplates,
        projectIdOrKey: this.projectIdOrKey,
        isAdmin: this.isAdmin,
        newTemplate,
        // Re-checked against storage when OK is pressed, so a template created while this dialog
        // was open still blocks the name.
        validateName: async (name: string, templateId: string) => {
          const currentTemplates = await this.loadTemplatesForScope(targetScope);
          return TemplatesComponent.isNameTaken(currentTemplates, name, templateId)
            ? 'Template name is already in use, please use another name.'
            : null;
        },
      },
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result) {
        if (result.scope !== TemplateScopes.PERSONAL && result.scope !== TemplateScopes.PROJECT) {
          return;
        }

        // Re-read so the save merges into whatever is in storage now instead of overwriting it
        // with the list this page started with.
        const currentTemplates = await this.loadTemplatesForScope(result.scope);
        const matchedIndex = currentTemplates.findIndex((t) => t.id === result.id);
        result.updatedAt = new Date();
        result.updatedBy =
          result.scope === TemplateScopes.PERSONAL ? UtilsService.stripUserModel(this.currentUser) : this.currentUser;
        if (matchedIndex > -1) {
          currentTemplates[matchedIndex] = result;
        } else {
          currentTemplates.push(result);
        }
        await this.saveTemplatesForScope(result.scope, currentTemplates);

        const analyticsScope = result.scope === TemplateScopes.PERSONAL ? 'personal.templates' : 'project.templates';
        AnalyticalService.sendEvent(matchedIndex > -1 ? ANALYTICAL_EVENTS.EDIT_ITEM : ANALYTICAL_EVENTS.ADD_ITEM, analyticsScope, {
          item_name: result.name,
          starred: result.starred,
          fields_used: UtilsService.templateContainsDollarVariables(result),
        });
        AnalyticalService.sendEvent(ANALYTICAL_EVENTS.VIEW_ITEM_LIST, analyticsScope, {
          item_count: currentTemplates.length,
          favorite_count: currentTemplates.filter((t) => t.starred).length,
          ...(result.scope === TemplateScopes.PROJECT ? { project_id_or_key: this.projectIdOrKey } : {}),
        });
      }
    });
  }

  async toggleTemplateStar(template: Template) {
    if (template.scope !== TemplateScopes.PERSONAL && template.scope !== TemplateScopes.PROJECT) {
      return;
    }

    template.starred = !template.starred;
    const currentTemplates = await this.loadTemplatesForScope(template.scope);
    const matchedTemplate = currentTemplates.find((t) => t.id === template.id);
    if (matchedTemplate) {
      matchedTemplate.starred = template.starred;
    }
    await this.saveTemplatesForScope(template.scope, currentTemplates);

    AnalyticalService.sendEvent(
      ANALYTICAL_EVENTS.EDIT_ITEM,
      template.scope === TemplateScopes.PERSONAL ? 'personal.templates' : 'project.templates',
      {
        item_name: template.name,
        starred: template.starred,
        fields_used: UtilsService.templateContainsDollarVariables(template),
      },
    );
  }

  async deleteTemplate(template: Template) {
    if (template.scope !== TemplateScopes.PERSONAL && template.scope !== TemplateScopes.PROJECT) {
      return;
    }

    if (await confirm('Are you sure?')) {
      const currentTemplates = await this.loadTemplatesForScope(template.scope);
      const index = currentTemplates.findIndex((t) => t.id === template.id);
      const templateToBeDelete: Template = index > -1 ? (currentTemplates.splice(index, 1)[0] as Template) : template;
      await this.saveTemplatesForScope(template.scope, currentTemplates);
      this.toastr.success(`${templateToBeDelete.name} deleted successfully`, `Success`);

      const analyticsScope = template.scope === TemplateScopes.PERSONAL ? 'personal.templates' : 'project.templates';
      AnalyticalService.sendEvent(ANALYTICAL_EVENTS.DELETE_ITEM, analyticsScope, {
        item_name: template.name,
        starred: template.starred,
        fields_used: UtilsService.templateContainsDollarVariables(template),
      });
      AnalyticalService.sendEvent(ANALYTICAL_EVENTS.VIEW_ITEM_LIST, analyticsScope, {
        item_count: currentTemplates.length,
        favorite_count: currentTemplates.filter((t) => t.starred).length,
        ...(template.scope === TemplateScopes.PROJECT ? { project_id_or_key: this.projectIdOrKey } : {}),
      });
    }
  }

  async cloneTemplate(template: Template) {
    const projectTemplates = await this.loadTemplatesForScope(TemplateScopes.PROJECT);
    const personalTemplates = await this.loadTemplatesForScope(TemplateScopes.PERSONAL);
    if (!UtilsService.canAddTemplate(template.scope, projectTemplates, personalTemplates)) {
      return;
    }

    const templateCopy = JSON.parse(JSON.stringify(template)) as Template;
    templateCopy.id = uuidv4();
    templateCopy.updatedAt = new Date();
    templateCopy.name = `Copy of ${templateCopy.name}`;
    this.openEditTemplateModal(templateCopy, templateCopy.scope);
  }
}
