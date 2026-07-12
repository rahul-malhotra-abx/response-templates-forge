import {NgModule} from '@angular/core';
import {Routes, RouterModule} from '@angular/router';
import {ProjectComponent} from './project/project.component';
import {ProjectSettingsComponent} from './settings/project-settings.component';
import {TemplatesComponent} from "./templates/templates.component";
import { SignaturesComponent } from './signatures/signatures.component';

const routes: Routes = [
  {
    path: '',
    component: ProjectComponent,
    children: [
      {
        path: 'templates',
        component: TemplatesComponent,
      },
      {
        path: 'settings',
        component: ProjectSettingsComponent,
      },
      {
        path: 'signatures',
        component: SignaturesComponent,
      }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ProjectRoutingModule {
}
