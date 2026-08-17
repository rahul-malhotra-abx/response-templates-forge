import { Component, OnInit } from '@angular/core';
import { SignatureTemplate } from '../../../models/template.model';
import { StorageService } from '../../../services/storage.service';
import { JiraUserModel } from '../../../models/jira.user.model';
import { UtilsService } from '../../../services/utils.service';
import { StorageContext } from '../../../models/storage.context.enum';
import { DataStorageKeys } from '../../../models/data.storage.keys.model';
import { ActivatedRoute } from '@angular/router';
import { JiraService } from '../../../services/jira.service';
import { v4 as uuidv4 } from 'uuid';
import { ToastrService } from 'ngx-toastr';
import { MatDialog } from '@angular/material/dialog';
import { EditSignatureComponent } from './edit-signature/edit-signature.component';
import { alert, confirm } from 'basic-modals';
import { DEFAULT_LIMITS } from '../../../models/default.limits';

@Component({
  selector: 'app-signatures',
  templateUrl: './signatures.component.html',
  styleUrls: ['./signatures.component.scss'],
})
export class SignaturesComponent implements OnInit {
  pageLoaded = false;
  currentUser: JiraUserModel;
  projectIdOrKey: string;
  parentDomain = UtilsService.getParentDomain();
  isAdmin = false;
  defaultSignatureLimit: number = DEFAULT_LIMITS.USER_SIGNATURES;

  allSignatures: SignatureTemplate[] = [];
  signatures: SignatureTemplate[] = [];
  signatureStorageService: StorageService;

  constructor(private toastr: ToastrService, private route: ActivatedRoute, public dialog: MatDialog) {}

  ngOnInit(): void {
    this.route.parent.params.subscribe(async (params) => {
      this.projectIdOrKey = params.id;
      this.currentUser = await JiraService.getCurrentJiraUser();

      this.signatureStorageService = new StorageService(StorageContext.USER, this.currentUser.accountId, DataStorageKeys.USER_SIGNATURES);
      this.signatures = (await this.signatureStorageService.get()) || ([] as SignatureTemplate[]);
      // console.log('signatures', this.signatures);

      this.allSignatures = [...this.signatures];

      const fetchUserRoles = ['SYSTEM_ADMIN', 'ADMINISTER', 'ADMINISTER_PROJECTS', 'EDIT_ISSUES'];
      const responseTemplateAdminRole = ['SYSTEM_ADMIN', 'ADMINISTER', 'ADMINISTER_PROJECTS'];
      const userPermissions = await JiraService.getUserPermissions(fetchUserRoles, this.projectIdOrKey);
      if (UtilsService.hasOneOfPermission(responseTemplateAdminRole, userPermissions)) {
        this.isAdmin = true;
      }

      this.pageLoaded = true;
    });
  }

  openEditSignatureModal(signature: SignatureTemplate): void {
    // Hiding the Add button was the only thing enforcing the cap, and it used `<=`, so the 11th
    // signature could still be created.
    if (!signature && this.allSignatures.length >= DEFAULT_LIMITS.USER_SIGNATURES) {
      alert(`Cannot add more than ${DEFAULT_LIMITS.USER_SIGNATURES} signatures.`);
      return;
    }

    const newSignature = !signature;
    signature = signature || {
      id: uuidv4(),
      name: '',
      content: '',
      active: false,
      updatedAt: new Date(),
      updatedBy: this.currentUser,
    };
    const dialogRef = this.dialog.open(EditSignatureComponent, {
      width: '600px',
      data: {
        signature: JSON.parse(JSON.stringify(signature)),
        signatures: this.allSignatures,
        projectIdOrKey: this.projectIdOrKey,
        isAdmin: this.isAdmin,
        newSignature,
      },
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result) {
        let matchedIndex: number;
        matchedIndex = this.signatures.findIndex((t) => t.id === result.id);
        result.updatedAt = new Date();
        result.updatedBy = UtilsService.stripUserModel(this.currentUser);
        if (matchedIndex > -1) {
          this.signatures[matchedIndex] = result;
        } else {
          this.signatures.push(result);
        }
        await this.signatureStorageService.save(this.signatures);

        this.allSignatures = [...this.signatures];
      }
    });
  }

  async toggleActiveSignature(signature: SignatureTemplate) {
    signature.active = !signature.active;
    if (signature.active) {
      this.signatures.forEach((sign) => {
        if (sign.id !== signature.id) {
          sign.active = false;
        }
      });
    }
    await this.signatureStorageService.save(this.signatures);
  }

  async deleteSignature(signature: SignatureTemplate) {
    if (await confirm('Are you sure?')) {
      const index = this.signatures.findIndex((t) => t.id === signature.id);
      const signatureToBeDelete: SignatureTemplate = this.signatures.splice(index, 1)[0] as SignatureTemplate;
      await this.signatureStorageService.save(this.signatures);
      this.toastr.success(`${signatureToBeDelete.name} deleted successfully`, `Success`);
      this.allSignatures = [...this.signatures];
    }
  }
}
