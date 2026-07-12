import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TicketResponseComponent } from './ticket-response.component';

describe('TicketResponseComponent', () => {
  let component: TicketResponseComponent;
  let fixture: ComponentFixture<TicketResponseComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ TicketResponseComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TicketResponseComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
