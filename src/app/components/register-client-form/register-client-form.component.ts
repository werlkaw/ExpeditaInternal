import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { AbstractControl, FormBuilder, FormControl, ValidatorFn } from '@angular/forms';
import { AngularFireFunctions } from '@angular/fire/functions';

export enum RequestStatus {
  PENDING, SUCCESS, FAILURE
}

@Component({
  selector: 'app-register-client-form',
  templateUrl: './register-client-form.component.html',
  styleUrls: ['./register-client-form.component.css']
})
export class RegisterClientFormComponent implements OnInit {

  @Output() requestStatus = new EventEmitter<RequestStatus>();
  requestForm;
  months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  years = [2020, 2021, 2022, 2023, 2024, 2025, 2026,
           2027, 2028, 2029, 2030, 2031, 2032, 2033,
           2034, 2035, 2036, 2037, 2038, 2039, 2040];
  cfdiOptions = [{
    value: "G03",
    description: "G03 - Gastos en general"
  }, {
    value: "P01",
    description: "P01 - Por Definir"  
  }];
  tracker_quantity = [];

  constructor(private formBuilder: FormBuilder, private firebaseFunctions: AngularFireFunctions) {
    for (let i = 1; i <101; i++) {
      this.tracker_quantity.push(i);
    }
    this.requestForm = this.formBuilder.group({
      name: '',
      email: '',
      rfc: '',
      cfdiUse: new FormControl('',[this.cfdiValidator()]),
      tracker_quantity: 1,
      card_number: '',
      card_month: 1,
      card_year: 2020,
      card_cvv: '',
      accept_terms: false
    });
  }

  private cfdiValidator(): ValidatorFn {
    return (control: AbstractControl): {[key: string]: any} | null => {
      return this.cfdiOptions.filter((entry) => {return entry.value == control.value}).length > 0 ?
        null : {forbiddenCfdi: {value: control.value}};
    };
  }

  ngOnInit(): void {
  }

  public async orderTrackers() {
    if (this.requestForm.invalid) {
      return;
    }
    this.requestStatus.emit(RequestStatus.PENDING);
    this.firebaseFunctions.httpsCallable('createCustomer')({
      customer: {
        name: this.requestForm.controls.name.value,
        email: this.requestForm.controls.email.value,
        description: "Se solicitan " + this.requestForm.controls.tracker_quantity.value + " gps.",
        rfc: this.requestForm.controls.rfc.value,
        cfdiUse: this.requestForm.controls.cfdiUse.value
      },
      tracker_quantity: this.requestForm.controls.tracker_quantity.value,
      card_details: {
        number: this.requestForm.controls.card_number.value,
        month: this.requestForm.controls.card_month.value,
        year: this.requestForm.controls.card_year.value,
        cvv: this.requestForm.controls.card_cvv.value
      },
      test: false
    }).subscribe((response) => {
      console.log(response);
      if (response.status == 200) {
        this.requestStatus.emit(RequestStatus.SUCCESS);
      } else {
        this.requestStatus.emit(RequestStatus.FAILURE);
      }
    });
  }
}
