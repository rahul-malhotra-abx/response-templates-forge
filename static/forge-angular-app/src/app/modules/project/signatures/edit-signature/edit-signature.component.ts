import { Component, ElementRef, Inject, OnInit, ViewChild } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { SignatureTemplate } from '../../../../models/template.model';
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
import { DEFAULT_LIMITS } from '../../../../models/default.limits';

@Component({
  selector: 'app-edit-signature',
  templateUrl: './edit-signature.component.html',
  styleUrls: ['./edit-signature.component.scss'],
})
export class EditSignatureComponent implements OnInit {
  public editorAppPath: any;
  protected frameWrapper: FrameWrapper;

  @ViewChild('commentFrame') iframeDom: ElementRef;
  @ViewChild(MatAutocompleteTrigger) matAutocomplete: MatAutocompleteTrigger;

  signature: SignatureTemplate;
  initialCopy: SignatureTemplate;
  signatures: SignatureTemplate[];
  model: any;
  availableColumns = [];
  myControl = new FormControl();
  filteredOptions: Observable<any[]>;
  loadingEditor = false;
  editing = false;
  isAdmin = false;
  newSignature = false;
  currentCursorPos: { lastPosition: number; lastPositionPath: any[]; lastPositionParentOffset: number };
  DefaultLimits = DEFAULT_LIMITS;

  constructor(
    private sanitizer: DomSanitizer,
    private toastr: ToastrService,
    private dialogRef: MatDialogRef<EditSignatureComponent>,
    @Inject(MAT_DIALOG_DATA) public dataFromPatent: any
  ) {
    dialogRef.disableClose = true;
    this.signature = dataFromPatent.signature as SignatureTemplate;
    this.initialCopy = JSON.parse(JSON.stringify(this.signature));
    this.signatures = dataFromPatent.signatures as SignatureTemplate[];
    this.isAdmin = dataFromPatent.isAdmin;
    this.newSignature = dataFromPatent.newSignature;
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

  async copyToClipBoard(option) {
    const variable = '${' + option.key + '}';
    if (await UtilsService.copyTextToClipboard(variable)) {
      this.toastr.success(`${variable} copied to clipboard`, 'Copied');
    } else {
      this.toastr.error('Could not copy. Select the variable and copy it manually.', 'Copy failed');
    }
  }

  cancelEditing() {
    this.dialogRef.close();
  }

  async clickOk() {
    if (!this.signature.name) {
      alert('Signature name is required.');
      return;
    }

    for (const signature of this.signatures) {
      if (signature.name === this.signature.name && signature.id !== this.signature.id) {
        alert('Signature name is already in use, please use another name.');
        return;
      }
    }

    if (this.signature.content.content?.length === 0) {
      alert('Content is required.');
      return;
    }

    this.dialogRef.close(this.signature);
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
      this.signature.content = data.value;
      this.iframeDom.nativeElement.height = `${data.props.height} px`;
    });
    setTimeout(async () => {
      this.loadingEditor = false;
      await this.frameWrapper.setProps({
        showSave: false,
        showCancel: false,
        appearance: '',
        placeholder: 'Add a comment',
        value: this.signature.content,
      });
    });
  }
}
