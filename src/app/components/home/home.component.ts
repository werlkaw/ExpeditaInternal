import { Component, OnInit } from '@angular/core';
import { RequestStatus } from '../register-client-form/register-client-form.component';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {
  showRegistration = true;
  showLoading = false;
  showSuccess = false;
  showFailure= false;
  constructor() { }

  ngOnInit(): void {
  }

  public handleRequestUpdate(requestStatus: RequestStatus) {
    this.showLoading = false;
    this.showRegistration = false;
    this.showSuccess = false;
    switch (requestStatus) {
      case RequestStatus.PENDING: {
        this.showLoading = true;
        break;
      }
      case RequestStatus.SUCCESS: {
        this.showSuccess = true;
        break;
      }
      case RequestStatus.FAILURE: {
        this.showFailure = true;
        break;
      }
      default: {
        this.showRegistration = true;
      }
    }
  }
}
