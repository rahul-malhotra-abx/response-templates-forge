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
import { MatDialog } from '@angular/material/dialog';
import { EditTemplateComponent } from './edit-template/edit-template.component';
import { confirm } from 'basic-modals';
import { ImportTemplateComponent } from './import-template/import-template.component';

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

  constructor(private route: ActivatedRoute, public dialog: MatDialog) {}

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
      const userPermissions = await JiraService.getUserPermissions(fetchUserRoles, this.projectIdOrKey);
      if (UtilsService.hasOneOfPermission(responseTemplateAdminRole, userPermissions)) {
        this.isAdmin = true;
      }

      this.pageLoaded = true;
    });
  }

  /** Re-read before every write — the lists loaded with the page go stale. */
  private async loadTemplatesForScope(scope: string): Promise<Template[]> {
    const storageService = scope === TemplateScopes.PERSONAL ? this.personalTemplateStorageService : this.projectTemplateStorageService;
    return ((await storageService?.get()) || []) as Template[];
  }

  /** Stores first, then adopts the list — a rejected write must not leave the table showing it. */
  private async saveTemplatesForScope(scope: string, templates: Template[]) {
    if (scope === TemplateScopes.PERSONAL) {
      await this.personalTemplateStorageService.save(templates);
      this.personalTemplates = templates;
    } else {
      await this.projectTemplateStorageService.save(templates);
      this.projectTemplates = templates;
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
        try {
          await this.saveTemplatesForScope(TemplateScopes.PROJECT, currentTemplates);
        } catch (e) {
          return;
        }
        JiraService.showFlag({
          title: 'Imported',
          body: `${result.length} ${result.length === 1 ? 'template' : 'templates'} imported into this project.`,
          type: 'success',
        });
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

        try {
          await this.saveTemplatesForScope(result.scope, currentTemplates);
        } catch (e) {
          return;
        }
        JiraService.showFlag({
          title: matchedIndex > -1 ? 'Updated' : 'Created',
          body: `${result.scope} template "${result.name}" ${matchedIndex > -1 ? 'updated' : 'created'} successfully.`,
          type: 'success',
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

    try {
      await this.saveTemplatesForScope(template.scope, currentTemplates);
    } catch (e) {
      template.starred = !template.starred;
      return;
    }

  }

  async deleteTemplate(template: Template) {
    if (template.scope !== TemplateScopes.PERSONAL && template.scope !== TemplateScopes.PROJECT) {
      return;
    }

    if (await confirm('Are you sure?')) {
      const currentTemplates = await this.loadTemplatesForScope(template.scope);
      const index = currentTemplates.findIndex((t) => t.id === template.id);
      const templateToBeDelete: Template = index > -1 ? (currentTemplates.splice(index, 1)[0] as Template) : template;

      try {
        await this.saveTemplatesForScope(template.scope, currentTemplates);
      } catch (e) {
        return;
      }
      JiraService.showFlag({
        title: 'Deleted',
        body: `${template.scope} template "${templateToBeDelete.name}" deleted successfully.`,
        type: 'success',
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
