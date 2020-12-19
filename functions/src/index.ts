import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as Constants from './constants';
import { ExpeditaFirestore } from './expedita-firestore';
import { Facturama } from './facturama';
import { Customer, FacturamaCfdiItem, FacturamaCustomerTaxInfo, FacturamaReceiver } from './models';
import { StripeService } from './stripe';
import { ConektaService } from './conekta';

admin.initializeApp(functions.config().firebase);

import * as ConektaStripeMap from './firestore/conekta-stripe-map';

const MONTHS = ["enero",
 "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre",
 "octubre", "noviembre", "diciembre"];

 const TAX_RESIDENCES : { [key:string]:string; } = {
     "us_ein": "USA"
 }

const DEBIT_CARD_PAYMENT_FORM = "28";
const ELECTRONIC_TRANSFER_PAYMENT_FORM = "03";
// const UNDEFINED_PAYMENT_FORM = "99";

let axios = require('axios');

export const createCustomer = functions.https.onCall(async (data, context) => {
    const stripeService = new StripeService(data.livemode);
    const conektaService = new ConektaService();
    try {
        if (data.card_details) {
            var card = await stripeService.paymentMethods.createCard({
                "number": data.card_details.number,
                "exp_month": data.card_details.month,
                "exp_year": data.card_details.year,
                "cvc": data.card_details.cvv,
            });
        }
        let customerData: Customer = {
            name: data.customer.name,
            description: data.customer.description,
            email: data.customer.email,
        };
        if (data.customer.rfc) {
            customerData.tax_id_data = [{
                type: "mx_rfc",
                value: data.customer.rfc
            }]
        }
        if (data.customer.cfdiUse) {
            customerData.metadata = {
                [Constants.StripeMetadata.CFDI_USE]: data.customer.cfdiUse
            }
        }
        if (card) {
            var stripeCustomer = await stripeService.customers.addCustomer(customerData, card);
        } else {
            var conektaCustomer = (await conektaService.customers.addCustomer({
                name: customerData.name,
                email: customerData.email
            })).toObject();
            var stripeCustomer = await stripeService.customers.addCustomer(customerData);
            ConektaStripeMap.addEntry(conektaCustomer.id, stripeCustomer.id);
        }

        // Turning off auto subscriptions for now.
        // if (data.test) {
        //     await stripeService.subscriptions.create({
        //         customer: stripeCustomer.id,
        //         trackers: data.tracker_quantity,
        //         subscriptions: data.tracker_quantity
        //     }); 
        // }
        return {
            status: 200,
            message: "Success. Added customer to conekta, stripe, and RTDB."
        }
    } catch (error) {
        return {
            status: 500,
            message: error.message
        }
    }
});

function getRfcFromTaxIds(taxIds: any[]) {
    let customerRfcOptions = taxIds.filter(
        (e: any) => {
            return e.type == "mx_rfc";
        }).map((e: any) => {
            return e.value;
        });
    if (customerRfcOptions.length == 1) {
        return customerRfcOptions[0];
    } else {
        return undefined;
    }
}

export const registerNumber = functions.https.onCall(async (data, context) => {
    try {
        await axios.post(Constants.ApiPathConstants.TWILIO_REGISTER_NUMBER, {
            "EXPEDITA_SECRET_KEY": functions.config().expedita.api_key,
            "Telefono": data.phone
        });
        return "done!";
    } catch (error) {
        return "some error!";
    }
});

// Divide by 100 and return result as string.
function stripeToFacturamaNumber(stripeNumber: number, excludeCents: boolean = false): string {
    return excludeCents ? String(stripeNumber / 100) : (stripeNumber / 100).toFixed(2);
}

async function getFacturamaCfdiItems(items: any[], stripeService: StripeService, invoicePreviousMonth: string = "") {
    let cfdiItems: FacturamaCfdiItem[] = [];
    let itemDate = new Date();
    if (invoicePreviousMonth.toLowerCase().trim() == "true") {
        let prevMonth = itemDate.getMonth();
        itemDate.setMonth(itemDate.getMonth() - 1);
        while (itemDate.getMonth() === prevMonth) {
            itemDate.setDate(itemDate.getDate() - 1);
        }
    }
    for (let item of items) {
        let product = await stripeService.products.get(item.price.product);
        let itemTotal = item.amount;
        let facturamaItem: FacturamaCfdiItem = {
            ProductCode: product.metadata[Constants.StripeMetadata.SAT_CODE],
            Description: [product.description, MONTHS[itemDate.getMonth()], itemDate.getFullYear()].join(' '),
            UnitCode: product.metadata[Constants.StripeMetadata.UNIT_CODE],
            UnitPrice: (item.price.unit_amount / 100).toFixed(2), //Stripe sends amounts in cents.
            Quantity: item.quantity,
            Subtotal: stripeToFacturamaNumber(item.amount),
            Taxes: [],
            Total: ""
        };

        // Add taxes
        for (let tax of item.tax_amounts) {
            facturamaItem.Taxes.push({
                Name: "IVA",
                Total: stripeToFacturamaNumber(tax.amount),
                Base: facturamaItem.Subtotal,
                Rate: "0.16",
                IsRetention: "false"
            });
            itemTotal += tax.amount;
        }
        facturamaItem.Total = stripeToFacturamaNumber(itemTotal);
        cfdiItems.push(facturamaItem);
    }
    return cfdiItems;
}

function sendErrorMail(webhookName: string, requestInfo: any) {
    let mailer = new ExpeditaFirestore(admin.firestore());
    let messageText = "There was an error with " + webhookName + ": " + JSON.stringify(requestInfo);
    mailer.addMailEntry({
        from: "errors@expeditalogistics.com",
        to: ["jab675@cornell.edu"],
        message: {
            html: messageText,
            text: messageText,
            subject: "Facturama error!"
        }
    })
}

export const stripeWebhook = functions.https.onRequest(async (request, response) => {
    let stripeEvent = request.body;
    console.log("Event: " + JSON.stringify(stripeEvent));
    if (stripeEvent.type != "invoice.payment_succeeded" && 
           (stripeEvent.type != "invoice.finalized" || stripeEvent.data.object.collection_method != "send_invoice")) {
        let message = "I don't support this operation yet: " + stripeEvent.type + " " + stripeEvent.data.object.collection_method;
        console.log(message); 
        response.end(message);
        return;
    } else {
        let message = "Running operation: " + stripeEvent.type + " " + stripeEvent.data.object.collection_method;
        console.log(message); 
    }
    try {
        const stripeService = new StripeService(stripeEvent.livemode);
        const facturama = new Facturama(stripeEvent.livemode);
        let stripeCustomer = await stripeService.customers.getCustomer(stripeEvent.data.object.customer);
        if (!stripeCustomer.tax_ids) {
            console.log("Customer doesn't have tax_ids, will not emit CFDI.");
            response.end("No CFDI to emit. Customer doesn't have tax id.");
            return;
        }
        let customerRfc = getRfcFromTaxIds(stripeCustomer.tax_ids.data);

        // If the customer has non-RFC tax ids, they must be included in CFDI.
        let foreignTaxIds: FacturamaCustomerTaxInfo[] = stripeCustomer.tax_ids.data.filter(
            (e: any) => {
                return e.type != "mx_rfc";
            }).map((e: any) => {
                let id: string = e.value;
                id = id.replace(/[^A-Za-z0-9]/g,"");
                if (TAX_RESIDENCES[e.type]) {
                    return {
                        Country: TAX_RESIDENCES[e.type],
                        Id: id
                    }
                } else {
                    return {
                        Country: e.type,
                        Id: id
                    }
                }   
            });
        if (!customerRfc) {
            console.log("None of the tax_ids were RFC.");
            response.end("No CFDI to emit. Customer doesn't have RFC")
            return;
        }
        let cfdiUse = 
            stripeCustomer.metadata[Constants.StripeMetadata.CFDI_USE] ?
                stripeCustomer.metadata[Constants.StripeMetadata.CFDI_USE] :
                "P01";
        let cfdiItems = await getFacturamaCfdiItems(stripeEvent.data.object.lines.data,
                                                    stripeService,
                                                    stripeCustomer.metadata[Constants.StripeMetadata.INVOICE_PREVIOUS_MONTH]);
        let paymentMethod = "PUE";
        let paymentForm = DEBIT_CARD_PAYMENT_FORM;
        if (stripeEvent.type == "invoice.finalized" && stripeEvent.data.object.collection_method == "send_invoice") {
            paymentMethod = "PPD";
            paymentForm = ELECTRONIC_TRANSFER_PAYMENT_FORM;
        }

        console.log(JSON.stringify(cfdiItems));
        let receiver: FacturamaReceiver = {
            Rfc: customerRfc,
            Name: stripeCustomer.name,
            CfdiUse: cfdiUse
        }

        if (receiver.Rfc == "XEXX010101000" && foreignTaxIds) {
            receiver.TaxRegistrationNumber = foreignTaxIds[0].Id;
            receiver.TaxResidence = foreignTaxIds[0].Country;
        }
        let cfdiResponse = (await facturama.addCfdi({
            Receiver: receiver,
            PaymentMethod: paymentMethod,
            PaymentForm: paymentForm,
            items: cfdiItems
        })).data;

        // Add Cfdi info to invoice
        stripeService.invoices.addMetadataToInvoice(
            stripeEvent.data.object.id,
            {
                [Constants.StripeMetadata.CFDI_NUMBER]: cfdiResponse.Folio,
                [Constants.StripeMetadata.CFDI_UUID]: cfdiResponse.Complement.TaxStamp.Uuid
            });
        console.log(JSON.stringify(cfdiResponse));

        // Send
        facturama.sendCfdiEmail(stripeCustomer.email, cfdiResponse.Id, "issued");
        response.end("i'm done.");
    } catch (error) {
        sendErrorMail("stripeWebhook", stripeEvent);
        response.end("there was en error. Email sent!");
    }
});

// export const facturamaApi = functions.https.onRequest(async (request, response) => {   
//     try {
//         const facturama = new Facturama(request.query.prod == 'true');
//         let results = await facturama.complementoDePago();
//         console.log("data" + JSON.stringify(results.data));
//         response.end(JSON.stringify(results.data));
//     } catch (error) {
//         console.log("there was en error!!!");
//         console.log(JSON.stringify(error));
//         response.end(JSON.stringify(error.responseJSON));
//     }
// });

function getZeroTimeDateInMexico(eventTimestamp: number) {
    let utcDate = new Date(eventTimestamp * 1000);
    utcDate.setHours(utcDate.getHours() - 20);

    return [utcDate.getFullYear(), utcDate.getMonth(), utcDate.getDate()].join('-') + "T00:00:00.000Z"
}

export const conektaWebhook = functions.https.onRequest(async (request, response) => {

    console.log(JSON.stringify(request.body));
    if (request.body.livemode != true && request.body.type != "charge.paid") {
        console.log("not in livemode or not charge.paid");
        response.end("conekta operation: " + request.body.livemode + " " + request.body.type + " not supported");
        return;
    }

    const customerId = request.body.data.object.customer_id;
    const paymentData = request.body.data.object.payment_method;
    const paymentAttempts = paymentData.payment_attempts;


    if (paymentData.object != "bank_transfer_payment" || !paymentAttempts || paymentAttempts.length == 0) {
        sendErrorMail("conektaWebhook", paymentData);
        response.end("sent error email");
        return;
    }

    let payment;
    for (let attempt of paymentAttempts) {
        if (attempt.status == "paid") {
            payment = attempt;
            break;
        }
    }

    if (!payment) {
        sendErrorMail("conektaWebhook", {
            error: "none of the payment attempts were paid",
            request: paymentData
        });
        response.end("sent error email.")
        return;
    }

    try {
        
        const stripeId = await ConektaStripeMap.getStripeId(customerId);
        const stripeService = new StripeService(request.body.livemode);
        const openInvoices = await stripeService.invoices.getOpenInvoices(stripeId);
        if (openInvoices.length == 0) {
            sendErrorMail("conektaWebhook", {
                error: "no open invoices",
                request: paymentData
            });
            response.end("sent error email.")
            return;
        }

        let associatedInvoice;
        for (let word of payment.description.split(" ")) {
            let relevantInvoices = openInvoices.filter((elem) => {
                return word == elem.metadata[Constants.StripeMetadata.CFDI_NUMBER];
            });
            if (relevantInvoices.length > 1) {
                sendErrorMail("conektaWebhook", {
                    error: "too many relevant invoices",
                    request: paymentData
                });
                response.end("sent error email.")
                return;
            }
            if (relevantInvoices.length == 1 && relevantInvoices[0].amount_remaining == payment.amount) {
                associatedInvoice = relevantInvoices[0];
                break;
            }
        }
        if (associatedInvoice) {
            await stripeService.invoices.markAsPaid(associatedInvoice.id);
            const facturama = new Facturama(request.body.livemode);

            const compDePagoResponse = (await facturama.complementoDePago({
                factura: {
                    folio: associatedInvoice.metadata[Constants.StripeMetadata.CFDI_NUMBER],
                    total: stripeToFacturamaNumber(associatedInvoice.amount_due, true),
                    uuid: associatedInvoice.metadata[Constants.StripeMetadata.CFDI_UUID]
                },
                paymentAmount: stripeToFacturamaNumber(payment.amount, true),
                receiver: {
                    name: associatedInvoice.customer_name,
                    rfc: getRfcFromTaxIds(associatedInvoice.customer_tax_ids)
                },
                paymentDate: getZeroTimeDateInMexico(payment.executed_at)
            })).data;
            console.log("comp de pago: " + JSON.stringify(compDePagoResponse))

            stripeService.invoices.addMetadataToInvoice(
                associatedInvoice.id,
                {
                    [Constants.StripeMetadata.COMPLEMENTO_NUMBER]: compDePagoResponse.Folio,
                    [Constants.StripeMetadata.COMPLEMENTO_UUID]: compDePagoResponse.Complement.TaxStamp.Uuid
                });
            // Send
            await facturama.sendCfdiEmail(associatedInvoice.customer_email, compDePagoResponse.Id, "issued");
        } else {
            sendErrorMail("conektaWebhook", {
                error: "could not find associated invoice",
                request: paymentData
            });
            response.end("sent error email.")
            return;
        }
    } catch (e) {
        sendErrorMail("conektaWebhook", {
            error: JSON.stringify(e),
            request: paymentData
        });
        console.log(e);
        response.status(200).send("sent error email");
        return;
    }

    response.status(200).send(JSON.stringify(request.body));
});