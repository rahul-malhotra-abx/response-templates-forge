import { Component, ElementRef, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { map, startWith } from 'rxjs/operators';
import { FormControl } from '@angular/forms';
import { Observable, of } from 'rxjs';
import { Template, TemplateScopes, SignatureTemplate } from '../../../models/template.model';
import { StorageService } from '../../../services/storage.service';
import { StorageContext } from '../../../models/storage.context.enum';
import { DataStorageKeys } from '../../../models/data.storage.keys.model';
import { JiraService } from '../../../services/jira.service';
import { JiraUserModel } from '../../../models/jira.user.model';
import { DollarVariableService } from '../../../services/dollar.variable.service';
import { ENVIRONMENT } from '../../../environment';
import { DomSanitizer } from '@angular/platform-browser';
import { FrameWrapper } from '../../../models/frame.wrapper';
import { v4 as uuidv4 } from 'uuid';
import { UtilsService } from '../../../services/utils.service';
import { AnalyticalService, ANALYTICAL_EVENTS } from 'src/app/services/analytical.service';
import { MatTabChangeEvent } from '@angular/material/tabs';
import { MatDialog } from '@angular/material/dialog';
import { EditTemplateComponent } from '../../project/templates/edit-template/edit-template.component';
import { TemplateService } from 'src/app/services/template.service';

@Component({
  selector: 'app-ticket-response',
  templateUrl: './ticket-response.component.html',
  styleUrls: ['./ticket-response.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class TicketResponseComponent implements OnInit {
  public editorAppPath: any;
  protected frameWrapper: FrameWrapper;

  @ViewChild('commentFrame') iframeDom: ElementRef;
  @ViewChild('tabGroup') tabGroup;

  pageLoaded = false;
  model: any;
  templates: Template[];
  searchControl = new FormControl();
  // options: User[] = [{name: 'Mary'}, {name: 'Shelley'}, {name: 'Igor'}];
  filteredOptions: Observable<any[]>;
  projectIdOrKey: string;
  issueIdOrKey: string;
  currentUser: JiraUserModel;
  comment = '';
  issueData: any;
  projectData: any;
  templateScopes = TemplateScopes;
  editing = false;
  usedTemplate: Template;
  currentContent: any;
  editorLoaded = false;
  userTemplateProperties: any;
  recentTemplates: any[] = [];
  mostUsedTemplates: any[] = [];
  filters = ['All', 'Project', 'Personal', 'Global'];
  activeFilter = 'All';
  signatures: SignatureTemplate[] = [];
  isAdmin: boolean = false;
  projectTemplateStorageService: StorageService;
  personalTemplateStorageService: StorageService;
  isSavingTemplate = false;
  templateSearch = {
    string: '',
    filter: 'All',
  };
  tabMapping: any[];
  multipleUsedTemplates: Template[] = [];
  mergeTemplates: boolean = false;
  currentCursorPos: { lastPosition: number; lastPositionPath: any[]; lastPositionParentOffset: number };
  currentTabIndex: number = 0;
  currentTabLabel: string;

  constructor(
    private sanitizer: DomSanitizer,
    public dialog: MatDialog,
  ) {}

  async ngOnInit() {
    const jiraContext: any = await JiraService.getContext();
    this.projectIdOrKey = jiraContext?.extension?.project?.id || jiraContext?.jira?.project?.id;
    this.issueIdOrKey = jiraContext?.extension?.issue?.key || jiraContext?.jira?.issue?.key;
    this.editorAppPath = this.sanitizer.bypassSecurityTrustResourceUrl(ENVIRONMENT.EDITOR_APP_BASE_PATH);
    this.currentUser = await JiraService.getCurrentJiraUser();

    const signatureStorageService = new StorageService(StorageContext.USER, this.currentUser.accountId, DataStorageKeys.USER_SIGNATURES);
    this.signatures = (await signatureStorageService.get()) || ([] as SignatureTemplate[]);

    // CODE OPTIMIZATION (Repeated code/function)
    const fetchUserRoles = ['SYSTEM_ADMIN', 'ADMINISTER', 'ADMINISTER_PROJECTS', 'EDIT_ISSUES'];
    const responseTemplateAdminRole = ['SYSTEM_ADMIN', 'ADMINISTER', 'ADMINISTER_PROJECTS'];
    const userPermissions = await JiraService.getUserPermissions(fetchUserRoles, this.projectIdOrKey);
    if (UtilsService.hasOneOfPermission(responseTemplateAdminRole, userPermissions)) {
      this.isAdmin = true;
    }

    let projectTemplates: Template[] = [];
    let projectTemplateStorageService: StorageService;
    if (this.projectIdOrKey) {
      projectTemplateStorageService = new StorageService(StorageContext.PROJECT, this.projectIdOrKey, DataStorageKeys.TEMPLATES);
      projectTemplates = (await projectTemplateStorageService.get()) || ([] as Template[]);
    }

    const personalTemplateStorageService = new StorageService(StorageContext.USER, this.currentUser.accountId, DataStorageKeys.TEMPLATES);
    const personalTemplates = (await personalTemplateStorageService.get()) || ([] as Template[]);

    const globalTemplateStorageService = new StorageService(StorageContext.APPLICATION, null, DataStorageKeys.TEMPLATES);
    const globalTemplates = (await globalTemplateStorageService.get()) || ([] as Template[]);

    this.projectTemplateStorageService = projectTemplateStorageService;
    this.personalTemplateStorageService = personalTemplateStorageService;

    this.templates = [...projectTemplates, ...personalTemplates, ...globalTemplates];
    this.templates = this.templates.sort(UtilsService.dynamicSort('name'));

    this.filteredOptions = this.searchControl.valueChanges.pipe(
      startWith(''),
      map((value) => (typeof value === 'string' ? value : value.name)),
      map((name) => (name ? this._filter(name) : this.templates.slice())),
    );

    this.projectData = this.projectIdOrKey ? await JiraService.getProject(this.projectIdOrKey) : undefined;
    if (this.projectData?.projectTypeKey === 'service_desk') {
      this.tabMapping = [
        { key: 'INTERNAL_NOTE', label: 'Add internal note', position: 0 },
        { key: 'REPLY', label: 'Reply to customer', position: 1 },
        { key: 'DESCRIPTION', label: 'Description', position: 2 },
      ];
    } else {
      this.tabMapping = [
        { key: 'REPLY', label: 'Comment', position: 0 },
        { key: 'DESCRIPTION', label: 'Description', position: 1 },
      ];
    }

    this.pageLoaded = true;

    // Load Current user template usage properties
    this.userTemplateProperties = await JiraService.getUserProperties(this.currentUser.accountId, [DataStorageKeys.USER_TEMPLATE_USAGE]);
    let matchedTemplates = [];
    matchedTemplates = UtilsService.deepCopy([...this.templates]);
    if (Object.keys(this.userTemplateProperties).length !== 0) {
      matchedTemplates.forEach((template) => {
        // check if the template is a recently used template
        let foundTemplate = this.userTemplateProperties[DataStorageKeys.USER_TEMPLATE_USAGE].find(
          (recentTemplate) => template.id === recentTemplate.key,
        );

        if (foundTemplate) {
          // if its a recently used template, link it to a count & last_used value
          template['count'] = foundTemplate.count;
          template['last_used'] = foundTemplate.last_used;
        } else {
          template['count'] = 0;
          template['last_used'] = '0';
        }
      });

      // sort templates according to recent usage
      let recentSorted = [...matchedTemplates].sort(UtilsService.dynamicSort('last_used')).reverse();
      let mostSorted = [...matchedTemplates].sort(UtilsService.dynamicSort('count')).reverse();

      this.recentTemplates = recentSorted.filter((template) => template['last_used'] !== '0').slice(0, 5);
      this.mostUsedTemplates = mostSorted.filter((template) => template['count'] !== 0).slice(0, 5);
    }

    await this.loadEditor();
    if (!this.issueIdOrKey) {
      return;
    }

    this.issueData = await JiraService.getIssueWithProperties(this.issueIdOrKey);
  }

  displayFn(variable): string {
    return null;
  }

  private _filter(value: string): any[] {
    const filterValue = value.toLowerCase();
    return this.templates.filter((option) => option.name.toLowerCase().includes(filterValue));
  }

  filterList(event: any, filter: string) {
    if (event !== 'IGNORE_EVENT') event.stopPropagation();
    this.templateSearch.filter = filter || 'All';
    this.filteredOptions = of(
      [...this.templates]
        .filter((template) => this.templateSearch.filter === 'All' || template.scope === this.templateSearch.filter)
        .filter((template) => template.name.toLowerCase().includes(this.templateSearch.string)),
    );
  }

  searchFilter() {
    // this.activeFilter = 'All';
    this.filteredOptions = of(
      [...this.templates]
        .filter((template) => this.templateSearch.filter === 'All' || template.scope === this.templateSearch.filter)
        .filter((template) => template.name.toLowerCase().includes(this.templateSearch.string)),
    );
  }

  async useTemplate(template: Template, method) {
    if (this.mergeTemplates) {
      this.multipleUsedTemplates.push(template);
      TemplateService.mergeTemplate(this.usedTemplate, template, this.currentCursorPos);
    } else {
      this.multipleUsedTemplates = [{ ...template }];
      this.usedTemplate = UtilsService.deepCopy(template);
    }
    await this.startEditing();
    this.searchControl.setValue('');
    const commentResolvedString = await DollarVariableService.resolveDollarVariables(
      JSON.stringify(this.usedTemplate.content),
      this.currentUser,
      this.projectData,
      this.issueData,
    );
    setTimeout(async () => {
      let finalComment = commentResolvedString;
      let activeSignature = this.signatures.find((signature) => signature.active);
      // If there is an active signature and we are not merging templates or comment box is empty.
      if (activeSignature && (!this.currentContent?.content?.length || !this.mergeTemplates)) {
        finalComment = this.returnContentWithSignature(JSON.parse(commentResolvedString), activeSignature.content);
      }
      await this.frameWrapper.setProps({
        showSave: false,
        showCancel: false,
        appearance: '',
        placeholder: 'Add a comment',
        value: finalComment,
      });
    });
  }

  returnContentWithSignature(mainContent, signatureContent) {
    var newContent = { ...mainContent };
    if (Array.isArray(newContent.content)) {
      if (Array.isArray(signatureContent.content)) {
        signatureContent.content.forEach((contentBlock) => {
          newContent.content.push(contentBlock);
        });
      }
    }

    return newContent;
  }

  async loadEditor() {
    if (this.iframeDom && !this.editorLoaded) {
      this.editorLoaded = true;
      this.frameWrapper = new FrameWrapper(this.iframeDom.nativeElement, ENVIRONMENT.EDITOR_APP_BASE_PATH);
      await this.frameWrapper.init();
      await this.frameWrapper.listen('cursor-position', (data) => {
        const value = JSON.parse(data.value || '{}');
        this.currentCursorPos = value;
      });
      await this.frameWrapper.listen('change', (value) => {
        this.iframeDom.nativeElement.height = `${value.props.height || 150}px`;
        this.usedTemplate = this.usedTemplate || {
          id: uuidv4(),
          starred: false,
          content: [],
          scope: '',
          updatedAt: new Date(),
          updatedBy: this.currentUser,
          name: '',
        };
        this.usedTemplate.content = value.value;
        this.currentContent = value.value;
      });
      setTimeout(async () => {
        // let activeSignature = this.signatures.find(signature => signature.active);
        await this.frameWrapper.setProps({
          showSave: false,
          showCancel: false,
          appearance: '',
          placeholder: 'Add a comment',
          value: '', //activeSignature ? activeSignature.content : '',
        });
      });
    }
  }

  tabChanged(tabChangeEvent: MatTabChangeEvent): void {
    this.currentTabIndex = tabChangeEvent.index;
    this.currentTabLabel = tabChangeEvent.tab.textLabel;
  }

  /**
   * Templates are re-read from storage instead of reusing the list loaded with the issue view.
   * That snapshot goes stale as soon as anything is created elsewhere, which let duplicate names
   * through and made the save overwrite templates added since the page loaded.
   */
  private async loadTemplatesForScope(scope: string): Promise<Template[]> {
    const storageService = scope === TemplateScopes.PERSONAL ? this.personalTemplateStorageService : this.projectTemplateStorageService;
    return ((await storageService?.get()) || []) as Template[];
  }

  private static isNameTaken(templates: Template[], name: string, templateId: string) {
    const comparableName = (name || '').trim().toLowerCase();
    return templates.some((template) => template.id !== templateId && (template.name || '').trim().toLowerCase() === comparableName);
  }

  async saveAsNewTemplate() {
    this.isSavingTemplate = true;

    // A response composed in the editor has no scope and a global template is saved back as a
    // project one, so the limit has to be checked against the scope the copy actually lands in.
    const targetScope =
      this.usedTemplate?.scope && this.usedTemplate.scope !== TemplateScopes.GLOBAL ? this.usedTemplate.scope : TemplateScopes.PROJECT;

    const projectTemplates = await this.loadTemplatesForScope(TemplateScopes.PROJECT);
    const personalTemplates = await this.loadTemplatesForScope(TemplateScopes.PERSONAL);

    if (!this.usedTemplate || !UtilsService.canAddTemplate(targetScope, projectTemplates, personalTemplates)) {
      this.isSavingTemplate = false;
      return;
    }

    const newTemplate = {
      id: uuidv4(),
      name: this.usedTemplate.name !== '' ? 'Copy of ' + this.usedTemplate.name : 'New Template',
      content: this.usedTemplate.content,
      starred: false,
      scope: targetScope,
      updatedAt: new Date(),
      updatedBy: this.currentUser,
    };

    const dialogRef = this.dialog.open(EditTemplateComponent, {
      width: '600px',
      height: '95%',
      data: {
        template: JSON.parse(JSON.stringify(newTemplate)),
        templates: targetScope === TemplateScopes.PROJECT ? projectTemplates : personalTemplates,
        projectIdOrKey: this.projectIdOrKey,
        isAdmin: this.isAdmin,
        newTemplate,
        // Re-checked against storage when OK is pressed, so a template created while this dialog
        // was open still blocks the name.
        validateName: async (name: string, templateId: string) => {
          const currentTemplates = await this.loadTemplatesForScope(targetScope);
          return TicketResponseComponent.isNameTaken(currentTemplates, name, templateId)
            ? 'Template name is already in use, please use another name.'
            : null;
        },
      },
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result) {
        let matchedIndex: number;
        if (result.scope === TemplateScopes.PERSONAL) {
          // Re-read so the save merges into whatever is in storage now instead of overwriting it
          // with the list this issue view started with.
          const currentTemplates = await this.loadTemplatesForScope(TemplateScopes.PERSONAL);
          matchedIndex = currentTemplates.findIndex((t) => t.id === result.id);
          result.updatedAt = new Date();
          result.updatedBy = UtilsService.stripUserModel(this.currentUser);
          if (matchedIndex > -1) {
            currentTemplates[matchedIndex] = result;
          } else {
            currentTemplates.push(result);
            this.templates.push(result);
            this.filterList('IGNORE_EVENT', 'All');
          }
          try {
            await this.personalTemplateStorageService.save(currentTemplates);
          } catch (e) {
            // StorageService has already explained the failure; nothing was stored.
            this.isSavingTemplate = false;
            return;
          }
          JiraService.showFlag({
            title: 'Success',
            close: 'auto',
            body: 'New template created successfully',
            type: 'success',
          });
          this.usedTemplate = UtilsService.deepCopy(result);
          AnalyticalService.sendEvent(matchedIndex > -1 ? ANALYTICAL_EVENTS.EDIT_ITEM : ANALYTICAL_EVENTS.ADD_ITEM, 'personal.templates', {
            item_name: result.name,
            starred: result.starred,
            fields_used: UtilsService.templateContainsDollarVariables(result),
          });
          AnalyticalService.sendEvent(ANALYTICAL_EVENTS.VIEW_ITEM_LIST, 'personal.templates', {
            item_count: currentTemplates.length,
            favorite_count: currentTemplates.filter((t) => t.starred).length,
          });
        } else if (result.scope === TemplateScopes.PROJECT) {
          const currentTemplates = await this.loadTemplatesForScope(TemplateScopes.PROJECT);
          matchedIndex = currentTemplates.findIndex((t) => t.id === result.id);
          result.updatedAt = new Date();
          result.updatedBy = this.currentUser;
          if (matchedIndex > -1) {
            currentTemplates[matchedIndex] = result;
          } else {
            currentTemplates.push(result);
            this.templates.push(result);
            this.filterList('IGNORE_EVENT', 'All');
          }
          try {
            await this.projectTemplateStorageService.save(currentTemplates);
          } catch (e) {
            this.isSavingTemplate = false;
            return;
          }
          JiraService.showFlag({
            title: 'Success',
            close: 'auto',
            body: 'New template created successfully',
            type: 'success',
          });
          this.usedTemplate = UtilsService.deepCopy(result);
          AnalyticalService.sendEvent(matchedIndex > -1 ? ANALYTICAL_EVENTS.EDIT_ITEM : ANALYTICAL_EVENTS.ADD_ITEM, 'project.templates', {
            item_name: result.name,
            starred: result.starred,
            fields_used: UtilsService.templateContainsDollarVariables(result),
          });
          AnalyticalService.sendEvent(ANALYTICAL_EVENTS.VIEW_ITEM_LIST, 'project.templates', {
            item_count: currentTemplates.length,
            favorite_count: currentTemplates.filter((t) => t.starred).length,
            project_id_or_key: this.projectIdOrKey,
          });
        }
      }
      this.isSavingTemplate = false;
    });
  }

  saveResponse() {
    const currentTab = this.tabMapping[this.currentTabIndex];
    if (currentTab.key === 'INTERNAL_NOTE') this.postComment(true);
    else if (currentTab.key === 'REPLY') this.postComment(false);
    else if (currentTab.key === 'DESCRIPTION') this.postComment(false, true);
    else {
      this.postComment(false);
    }
  }

  async postComment(internalComment: boolean = false, updateDescription?: boolean) {
    try {
      updateDescription
        ? await JiraService.updateTicketDescription(this.issueIdOrKey, this.usedTemplate.content)
        : await JiraService.addTicketComment(
            this.issueIdOrKey,
            this.usedTemplate.content,
            [
              {
                key: 'templateId',
                value: { id: this.usedTemplate.id },
              },
            ],
            internalComment,
          );
    } catch (e) {
      JiraService.showFlag({
        title: 'Error',
        body: updateDescription
          ? 'Could not update the description. Please check your permissions and try again.'
          : 'Could not post the comment. Please check your permissions and try again.',
        type: 'error',
      });
      return;
    }
    JiraService.showFlag({
      title: 'Success',
      close: 'auto',
      body: updateDescription ? 'Description updated successfully' : 'Comment posted successfully',
      type: 'success',
    });
    AnalyticalService.sendEvent(ANALYTICAL_EVENTS.SAVE_ITEM, 'ticket.view', { save_type: ` ${internalComment ? 'internal' : 'external'} comment` });
    await this.saveRecentTemplates([...this.multipleUsedTemplates]);
    JiraService.refreshIssuePage();
  }

  async saveRecentTemplates(arrayOfUsedTemplates: Template[]) {
    const uniqueTemplateIDs = [...new Set(arrayOfUsedTemplates.map((item) => item.id))];
    let valueArray: any[] = [];
    let recentlyUsedTemplates = this.userTemplateProperties[DataStorageKeys.USER_TEMPLATE_USAGE] || [];
    if (recentlyUsedTemplates) {
      for (let index = 0; index < uniqueTemplateIDs.length; index++) {
        const templateID = uniqueTemplateIDs[index];
        let matchFound = false;

        for (let matchedIndex = 0; matchedIndex < recentlyUsedTemplates.length; matchedIndex++) {
          const recentTemplate = recentlyUsedTemplates[matchedIndex];
          if (templateID === recentTemplate.key) {
            matchFound = true;
            recentTemplate.count++;
            recentTemplate.last_used = new Date();
          }
        }
        if (!matchFound) {
          // if its the first time its being used, add to recently used templates
          recentlyUsedTemplates.push({ key: templateID, count: 1, last_used: new Date() });
        }
      }
      await JiraService.saveUserProperties(this.currentUser.accountId, [
        { key: DataStorageKeys.USER_TEMPLATE_USAGE, value: [...recentlyUsedTemplates] },
      ]);
    } else {
      // Object => {id: template.id, used_count: 1, last_used: datetime}
      for (let index = 0; index < uniqueTemplateIDs.length; index++) {
        const templateID = uniqueTemplateIDs[index];
        valueArray.push({ key: templateID, count: 1, last_used: new Date() });
      }
      await JiraService.saveUserProperties(this.currentUser.accountId, [{ key: DataStorageKeys.USER_TEMPLATE_USAGE, value: valueArray }]);
    }
    this.multipleUsedTemplates = [];
  }

  async startEditing(tabKey?: string) {
    tabKey = !this.editing && !tabKey ? 'REPLY' : tabKey;
    this.editing = true;
    await this.loadEditor();
    if (!this.usedTemplate?.content) {
      let activeSignature = this.signatures.find((signature) => signature.active);
      await this.frameWrapper.setProps({
        showSave: false,
        showCancel: false,
        placeholder: 'Add a comment',
        value: activeSignature ? activeSignature.content : '',
      });
    }
    // Without a tab key — inserting a template while already editing — keep the tab the user
    // picked. Resetting the index forced every JSM response back to "Add internal note".
    if (tabKey) {
      this.currentTabIndex = this.tabMapping.find((tab) => tab.key === tabKey)?.position ?? 0;
    }
    this.currentTabLabel = this.tabMapping[this.currentTabIndex].label;
  }

  async cancelEditing() {
    this.editing = false;
    this.editorLoaded = false;
    await this.frameWrapper.setProps({
      showSave: false,
      showCancel: false,
      placeholder: 'Add a comment',
      value: '',
    });
    AnalyticalService.sendEvent(ANALYTICAL_EVENTS.CANCEL_ITEM, 'ticket.view', {});
  }

  isSaveDisabled() {
    return !this.usedTemplate || !this.usedTemplate.content || this.usedTemplate.content['content'].length === 0;
  }
}
