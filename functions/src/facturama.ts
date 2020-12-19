import * as functions from 'firebase-functions';
import { FacturamaCdfiData, FacturamaComplementoDePago } from "./models";

let axios = require('axios');

const BASE_URL_TEST = "https://apisandbox.facturama.mx/";
const BASE_URL_PROD = "https://api.facturama.mx/";

export class Facturama {
    private axiosInstance: any;
    constructor(isProd: boolean = false) {
        this.axiosInstance = axios.create({
            baseURL: isProd ? BASE_URL_PROD : BASE_URL_TEST,
            withCredentials: true
        });
        let authKey = isProd ? functions.config().facturama.auth_prod : functions.config().facturama.auth_test;
        this.axiosInstance.defaults.headers.common['Authorization'] = authKey;
    }
    
    public addCfdi(cdfiData: FacturamaCdfiData) {
        return this.axiosInstance.post("2/cfdis", {
            "Currency": "MXN",
            "ExpeditionPlace": "21254",
            "CfdiType": "I",
            "PaymentForm": cdfiData.PaymentForm,
            "PaymentMethod": cdfiData.PaymentMethod,
            "Receiver": cdfiData.Receiver,
            "Items": cdfiData.items
        });
    }

    public complementoDePago(data: FacturamaComplementoDePago) {
        const compData = {
            "NameId": 14,
            "ExpeditionPlace": "21254",
            "CfdiType": "P",
            "Receiver": {
                "Rfc": "BUQJ920306PY9",
                "Name": data.receiver.name,
                "CfdiUse": "P01"
            },
            "Complemento": {
                "Payments": [{
                    "Date": data.paymentDate,
                    "PaymentForm": "03",
                    "Currency": "MXN",
                    "Amount": data.paymentAmount,
                    "RelatedDocuments": [{
                        "Uuid": data.factura.uuid,                    
                        "Folio": data.factura.folio,
                        "Currency": "MXN",
                        "PaymentMethod": "PPD",
                        "PartialityNumber": "1",
                        "PreviousBalanceAmount": data.factura.total,
                        "AmountPaid": data.paymentAmount
                    }]
                }]
            }
        };
        console.log(JSON.stringify(compData));
        return this.axiosInstance.post("2/cfdis", compData);
    }

    public sendCfdiEmail(email:string, cfdiId: string, cfdiType: string) {
        return this.axiosInstance.post("cfdi", null, {
            params: {
                cfdiType: cfdiType,
                cfdiId: cfdiId,
                email: email
            }
        });
    }

    public getClients() {
        return this.axiosInstance.get("client");
    }

    public getCfdiNames() {
        return this.axiosInstance.get("Catalogs/NameIds");
    }

    public addClient(clientData: object) {
        return this.axiosInstance.get("client");
    }
}