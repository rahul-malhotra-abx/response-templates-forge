import {NgModule} from '@angular/core';
import {Routes, RouterModule} from '@angular/router';
import {TicketComponent} from './ticket/ticket.component';
import {TicketResponseComponent} from './ticket-response/ticket-response.component';

const routes: Routes = [
  {
    path: '',
    component: TicketComponent,
    children: [
      {
        path: '',
        redirectTo: 'response',
        pathMatch: 'full'
      },
      {
        path: 'response',
        component: TicketResponseComponent,
      }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class TicketRoutingModule {
}
