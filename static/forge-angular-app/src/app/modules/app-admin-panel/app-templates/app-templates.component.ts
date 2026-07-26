import { Component, OnInit } from '@angular/core';
import { Template, TemplateScopes } from '../../../models/template.model';
import { StorageService } from '../../../services/storage.service';
import { DEFAULT_LIMITS } from '../../../models/default.limits';
import { JiraUserModel } from '../../../models/jira.user.model';
import { ToastrService } from 'ngx-toastr';
import { MatDialog } from '@angular/material/dialog';
import { StorageContext } from '../../../models/storage.context.enum';
import { DataStorageKeys } from '../../../models/data.storage.keys.model';
import { JiraService } from '../../../services/jira.service';
import { EditTemplateComponent } from '../../project/templates/edit-template/edit-template.component';
import { v4 as uuidv4 } from 'uuid';
import { alert, confirm } from 'basic-modals';
import { ENVIRONMENT } from '../../../environment';
import { UtilsService } from 'src/app/services/utils.service';
import { AnalyticalService, ANALYTICAL_EVENTS } from 'src/app/services/analytical.service';

@Component({
  selector: 'app-app-templates',
  templateUrl: './app-templates.component.html',
  styleUrls: ['./app-templates.component.scss'],
})
export class AppTemplatesComponent implements OnInit {
  templates: Template[] = [];
  templateStorageService: StorageService;
  pageLoaded = false;
  defaultLimits = DEFAULT_LIMITS;
  currentUser: JiraUserModel;

  constructor(private toastr: ToastrService, public dialog: MatDialog) {}

  async ngOnInit() {
    this.templateStorageService = new StorageService(StorageContext.APPLICATION, null, DataStorageKeys.TEMPLATES);
    this.templates = (await this.templateStorageService.get()) || ([] as Template[]);
    this.templates = this.templates.sort(UtilsService.dynamicSort('name'));
    this.currentUser = await JiraService.getCurrentJiraUser();
    this.pageLoaded = true;
    AnalyticalService.sendEvent(ANALYTICAL_EVENTS.VIEW_ITEM_LIST, 'global.templates', {
      item_count: this.templates.length,
      favorite_count: this.templates.filter((t) => t.starred).length,
    });
  }

  static canAddMoreTemplates(templates: Template[]) {
    if (ENVIRONMENT.FREE_VERSION && templates.length >= DEFAULT_LIMITS.FREE_GLOBAL_TEMPLATE_COUNT) {
      alert(
        `Cannot add more than ${DEFAULT_LIMITS.FREE_GLOBAL_TEMPLATE_COUNT} global templates in free version, upgrade to pro version to add more.`
      );
      return false;
    }

    if (ENVIRONMENT.PAID_VERSION && templates.length >= DEFAULT_LIMITS.GLOBAL_TEMPLATE_COUNT) {
      alert(`Cannot add more than ${DEFAULT_LIMITS.GLOBAL_TEMPLATE_COUNT} global templates.`);
      return false;
    }

    return true;
  }

  openEditTemplateModal(template?: Template): void {
    if (!template && !AppTemplatesComponent.canAddMoreTemplates(this.templates)) {
      return;
    }

    const newTemplate = !template;
    template = template || {
      id: uuidv4(),
      name: '',
      content: '',
      scope: TemplateScopes.GLOBAL,
      starred: false,
      updatedAt: new Date(),
      updatedBy: this.currentUser,
    };
    const dialogRef = this.dialog.open(EditTemplateComponent, {
      width: '600px',
      data: {
        template: JSON.parse(JSON.stringify(template)),
        templates: this.templates,
        newTemplate,
      },
    });

    dialogRef.afterClosed().subscribe(async (result: Template) => {
      if (result) {
        const matchedIndex = this.templates.findIndex((t) => t.id === result.id);
        result.updatedAt = new Date();
        result.updatedBy = this.currentUser;
        if (matchedIndex > -1) {
          this.templates[matchedIndex] = result;
        } else {
          this.templates.push(result);
        }
        await this.templateStorageService.save(this.templates);
        this.templates = this.templates.sort(UtilsService.dynamicSort('name'));
        AnalyticalService.sendEvent(matchedIndex > -1 ? ANALYTICAL_EVENTS.EDIT_ITEM : ANALYTICAL_EVENTS.ADD_ITEM, 'global.templates', {
          item_name: result.name,
          starred: result.starred,
          fields_used: UtilsService.templateContainsDollarVariables(result),
        });
        AnalyticalService.sendEvent(ANALYTICAL_EVENTS.VIEW_ITEM_LIST, 'global.templates', { item_count: this.templates.length });
      }
    });
  }

  async deleteTemplate(index) {
    if (await confirm('Are you sure?')) {
      const templateToBeDelete: Template = this.templates.splice(index, 1)[0] as Template;
      await this.templateStorageService.save(this.templates);
      this.toastr.success(`${templateToBeDelete.name} deleted successfully`, `Success`);
      AnalyticalService.sendEvent(ANALYTICAL_EVENTS.DELETE_ITEM, 'global.templates', {});
      AnalyticalService.sendEvent(ANALYTICAL_EVENTS.VIEW_ITEM_LIST, 'global.templates', { item_count: this.templates.length });
    }
  }

  async toggleTemplateStar(template: Template) {
    template.starred = !template.starred;
    await this.templateStorageService.save(this.templates);
    AnalyticalService.sendEvent(ANALYTICAL_EVENTS.EDIT_ITEM, 'global.templates', {
      item_name: template.name,
      starred: template.starred,
      fields_used: UtilsService.templateContainsDollarVariables(template),
    });
  }

  async cloneTemplate(template: Template) {
    if (!AppTemplatesComponent.canAddMoreTemplates(this.templates)) {
      return;
    }

    const templateCopy = JSON.parse(JSON.stringify(template)) as Template;
    templateCopy.id = uuidv4();
    templateCopy.updatedAt = new Date();
    templateCopy.name = `Copy of ${templateCopy.name}`;
    this.openEditTemplateModal(templateCopy);
  }
}
