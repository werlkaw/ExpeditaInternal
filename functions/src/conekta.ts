import * as functions from 'firebase-functions';

export class ConektaService {
    private conektaSdk = require('conekta');

    constructor() {
        this.conektaSdk.api_key = functions.config().conekta.api_key;
    }

    public customers = {
        addCustomer: (data: any) => {
            return this.conektaSdk.Customer.create(data);
        }
    }
}