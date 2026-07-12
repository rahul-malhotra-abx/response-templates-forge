import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {TicketComponent} from './ticket/ticket.component';
import {TicketResponseComponent} from './ticket-response/ticket-response.component';
import {TicketRoutingModule} from "./ticket-routing.module";
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import {MatAutocompleteModule} from "@angular/material/autocomplete";
import {MatFormFieldModule} from "@angular/material/form-field";
import {MatInputModule} from "@angular/material/input";
import {MatTabsModule} from '@angular/material/tabs';
import {MatDialogModule} from "@angular/material/dialog";

@NgModule({
  declarations: [
    TicketComponent,
    TicketResponseComponent
  ],
  imports: [
    TicketRoutingModule,
    FormsModule,
    ReactiveFormsModule,
    CommonModule,
    MatTabsModule,
    MatDialogModule,
    MatAutocompleteModule,
    MatFormFieldModule,
    MatInputModule
  ]
})
export class TicketModule {
}
