import { Component, ElementRef, Inject, OnInit, ViewChild } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Template, TemplateScopes } from '../../../../models/template.model';
import { DEFAULT_LIMITS } from '../../../../models/default.limits';
import { CUSTOM_DOLLAR_VARIABLES } from '../../../../models/custom.dollar.variables';
import { FormControl } from '@angular/forms';
import { Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { JiraService } from '../../../../services/jira.service';
import { ALLOWED_JIRA_COLUMN_RENDERERS } from '../../../../models/allowed.jira.column.renderers';
import { UtilsService } from '../../../../services/utils.service';
import { ToastrService } from 'ngx-toastr';
import { ENVIRONMENT } from '../../../../environment';
import { FrameWrapper } from '../../../../models/frame.wrapper';
import { DomSanitizer } from '@angular/platform-browser';
import { alert } from 'basic-modals';
import { MatAutocompleteTrigger } from '@angular/material/autocomplete';

@Component({
  selector: 'app-edit-template-modal',
  templateUrl: './edit-template.component.html',
  styleUrls: ['./edit-template.component.scss'],
})
export class EditTemplateComponent implements OnInit {
  public editorAppPath: any;
  protected frameWrapper: FrameWrapper;

  @ViewChild('commentFrame') iframeDom: ElementRef;
  @ViewChild(MatAutocompleteTrigger) matAutocomplete: MatAutocompleteTrigger;

  template: Template;
  initialCopy: Template;
  DefaultLimits = DEFAULT_LIMITS;
  templates: Template[];
  scope: string;
  model: any;
  availableColumns = [];
  myControl = new FormControl();
  filteredOptions: Observable<any[]>;
  loadingEditor = false;
  editing = false;
  isAdmin = false;
  newTemplate = false;
  currentCursorPos: { lastPosition: number; lastPositionPath: any[]; lastPositionParentOffset: number };
  templateScopes = TemplateScopes;

  constructor(
    private sanitizer: DomSanitizer,
    private toastr: ToastrService,
    private dialogRef: MatDialogRef<EditTemplateComponent>,
    @Inject(MAT_DIALOG_DATA) public dataFromPatent: any
  ) {
    dialogRef.disableClose = true;
    this.template = dataFromPatent.template as Template;
    this.initialCopy = JSON.parse(JSON.stringify(this.template));
    this.templates = dataFromPatent.templates as Template[];
    this.scope = this.template.scope || dataFromPatent.scope;
    this.isAdmin = dataFromPatent.isAdmin;
    this.newTemplate = dataFromPatent.newTemplate;
  }

  async ngOnInit() {
    this.editorAppPath = this.sanitizer.bypassSecurityTrustResourceUrl(ENVIRONMENT.EDITOR_APP_BASE_PATH);
    this.availableColumns = UtilsService.filterRenderableColumns(await JiraService.getJiraFields(), ALLOWED_JIRA_COLUMN_RENDERERS);
    this.availableColumns.push(...CUSTOM_DOLLAR_VARIABLES);
    this.availableColumns = this.availableColumns.sort((a, b) => {
      if (a.name < b.name) return -1;
      if (a.name > b.name) return 1;
      return 0;
    });
    this.filteredOptions = this.myControl.valueChanges.pipe(
      startWith(''),
      map((value) => (typeof value === 'string' ? value : value.name)),
      map((name) => (name ? this._filter(name) : this.availableColumns.slice()))
    );
    await this.loadEditor();
  }

  copyToClipBoard(option) {
    document.addEventListener('copy', (e) => {
      e.clipboardData.setData('text/plain', '${' + option.key + '}');
      e.preventDefault();
      document.removeEventListener('copy', null);
    });
    document.execCommand('copy');
  }

  async insertVariable(option) {
    this.matAutocomplete.closePanel();
    this.myControl.setValue('');
    if (this.currentCursorPos) {
      const variable = '${' + option.key + '}';
      let nodeToEdit = this.template.content;
      for (const [index, path] of Object.entries(this.currentCursorPos.lastPositionPath)) {
        const pathIndex = parseInt(index, 10);
        if (typeof path === 'object' && pathIndex < this.currentCursorPos.lastPositionPath.length - 3) {
          nodeToEdit = nodeToEdit.content[this.currentCursorPos.lastPositionPath[pathIndex + 1]];
        }
      }

      if (nodeToEdit && Array.isArray(nodeToEdit.content)) {
        if (nodeToEdit.content.length === 0) {
          nodeToEdit.content.push({ type: 'text', text: variable });
        } else {
          nodeToEdit.content[0].text =
            nodeToEdit.content[0].text.slice(0, this.currentCursorPos.lastPositionParentOffset) +
            variable +
            nodeToEdit.content[0].text.slice(this.currentCursorPos.lastPositionParentOffset);
        }
      } else {
        this.template.content = {
          version: 1,
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: variable }] }],
        };
      }

      await this.frameWrapper.setProps({
        showSave: false,
        showCancel: false,
        appearance: '',
        placeholder: 'Add a comment',
        value: this.template.content,
      });
    }
  }

  cancelEditing() {
    this.dialogRef.close();
  }

  async clickOk() {
    if (!this.template.name) {
      alert('Template name is required.');
      return;
    }

    for (const template of this.templates) {
      if (template.name === this.template.name && template.id !== this.template.id) {
        alert('Template name is already in use, please use another name.');
        return;
      }
    }

    if (this.template.content.content?.length === 0) {
      alert('Content is required.');
      return;
    }

    const props = await this.frameWrapper.getProps();
    this.dialogRef.close(this.template);
  }

  displayFn(variable): string {
    return variable && variable.name ? variable.name : '';
  }

  private _filter(value: string): any[] {
    const filterValue = value.toLowerCase();
    return this.availableColumns.filter((option) => option.name.toLowerCase().includes(filterValue));
  }

  async loadEditor() {
    this.loadingEditor = true;
    this.frameWrapper = new FrameWrapper(this.iframeDom.nativeElement, ENVIRONMENT.EDITOR_APP_BASE_PATH);
    await this.frameWrapper.init();
    await this.frameWrapper.listen('cursor-position', (data) => {
      const value = JSON.parse(data.value || '{}');
      this.currentCursorPos = value;
    });

    await this.frameWrapper.listen('change', (data) => {
      this.template.content = data.value;
      this.iframeDom.nativeElement.height = `${data.props.height} px`;
    });
    setTimeout(async () => {
      this.loadingEditor = false;
      await this.frameWrapper.setProps({
        showSave: false,
        showCancel: false,
        appearance: '',
        placeholder: 'Add a comment',
        value: this.template.content,
      });
    });
  }
}
