import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {ProjectComponent} from "./project/project.component";
import {ProjectSettingsComponent} from "./settings/project-settings.component";
import {TemplatesComponent} from "./templates/templates.component";
import {EditTemplateComponent} from "./templates/edit-template/edit-template.component";
import {ProjectRoutingModule} from "./project-routing.module";
import {MatDialogModule} from "@angular/material/dialog";
import {MatSlideToggleModule} from "@angular/material/slide-toggle";
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import {MatMenuModule} from "@angular/material/menu";
import {RouterModule} from "@angular/router";
import {MatTabsModule} from "@angular/material/tabs";
import {DragDropModule} from "@angular/cdk/drag-drop";
import {NgbTooltipModule} from "@ng-bootstrap/ng-bootstrap";
import {MatAutocompleteModule} from "@angular/material/autocomplete";
import {MatFormFieldModule} from "@angular/material/form-field";
import {MatInputModule} from "@angular/material/input";
import { ImportTemplateComponent } from './templates/import-template/import-template.component';
import { SignaturesComponent } from './signatures/signatures.component';
import { EditSignatureComponent } from './signatures/edit-signature/edit-signature.component';


@NgModule({
  declarations: [
    ProjectComponent,
    ProjectSettingsComponent,
    TemplatesComponent,
    EditTemplateComponent,
    ImportTemplateComponent,
    SignaturesComponent,
    EditSignatureComponent,
  ],
  imports: [
    CommonModule,
    ProjectRoutingModule,
    MatDialogModule,
    MatSlideToggleModule,
    MatMenuModule,
    RouterModule,
    NgbTooltipModule,
    MatTabsModule,
    DragDropModule,
    FormsModule,
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatFormFieldModule,
    MatInputModule
  ]
})
export class ProjectModule {
}
