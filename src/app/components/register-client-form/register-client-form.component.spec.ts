import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RegisterClientFormComponent } from './register-client-form.component';

describe('RegisterClientFormComponent', () => {
  let component: RegisterClientFormComponent;
  let fixture: ComponentFixture<RegisterClientFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ RegisterClientFormComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(RegisterClientFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
