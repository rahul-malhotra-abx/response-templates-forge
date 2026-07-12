import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { AppAdminPanelComponent } from './app-admin-panel.component';

const routes: Routes = [
  {
    path: '',
    component: AppAdminPanelComponent,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AppAdminPanelRoutingModule {}
