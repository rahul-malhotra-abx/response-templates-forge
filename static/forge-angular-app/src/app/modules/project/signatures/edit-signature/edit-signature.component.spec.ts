import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditSignatureComponent } from './edit-signature.component';

describe('EditSignatureComponent', () => {
  let component: EditSignatureComponent;
  let fixture: ComponentFixture<EditSignatureComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ EditSignatureComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(EditSignatureComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
