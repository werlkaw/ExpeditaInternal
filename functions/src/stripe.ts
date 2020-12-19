import * as functions from 'firebase-functions';
import * as Constants from './constants';
import { StripeCard, StripeSubscription } from "./models";


export class StripeService {
    stripeSdk: any;
    private readonly TRACKER_PRICE: string;
    private readonly SUBSCRIPTION_PRICE: string;
    private readonly TAX_RATE_16: string;

    constructor(liveMode: boolean) {
        let stripeKey = liveMode ? functions.config().stripe.live_key :
                                   functions.config().stripe.test_key;
        this.TRACKER_PRICE = liveMode ? "price_1HjCNeA33w8iNjZOZKyeFSNE" : "price_1HmqC5A33w8iNjZOJFZp9w39";
        this.SUBSCRIPTION_PRICE =  liveMode ? "price_1HjAkMA33w8iNjZOY2ngZgUI" : "price_1HmqD3A33w8iNjZOTnbGoLMg";
        this.TAX_RATE_16 = liveMode ? "txr_1HeVpnA33w8iNjZOrf8L2aoH" : "txr_1Hi4jvA33w8iNjZOsepIiatk";
        this.stripeSdk = require('stripe')(stripeKey);
    }

    public paymentMethods = {
        createCard: (cardDetails: StripeCard) => {
            return this.stripeSdk.paymentMethods.create({
                type: "card",
                card: cardDetails,
            });
        }
    }

    public invoices = {
        addCfdiNumberToInvoice: (invoiceId: string, cfdiNumber: string, cfdiUuid: string) => {
            return this.stripeSdk.invoices.update(
                invoiceId,
                {metadata: {
                    [Constants.StripeMetadata.CFDI_NUMBER]: cfdiNumber,
                    [Constants.StripeMetadata.CFDI_UUID]: cfdiUuid
                }}
            );
        },
        getOpenInvoices: async (customerId: string): Promise<any[]> => {
            let callData =  {
                customer: customerId,
                status: "open",
                limit: 20
            }
            let currResults = await this.stripeSdk.invoices.list(callData);
            let allResults: any[] = currResults.data;
            while (currResults.has_more) {
                currResults = await this.stripeSdk.invoices.list(callData);
                allResults = allResults.concat(currResults.data);
            }
            return allResults;
        },
        markAsPaid: (invoiceId: string) => {
            return this.stripeSdk.invoices.pay(
                invoiceId,
                { paid_out_of_band: true });
        }
    }

    public customers = {
        addCustomer: (customer: any, cardData?: any) => {
            if (cardData) {
                customer.invoice_settings = {
                    "default_payment_method": cardData.id
                };
                customer.payment_method = cardData.id
            }
            return this.stripeSdk.customers.create(customer);
        },
        getCustomer: (customerId: string) => {
            return this.stripeSdk.customers.retrieve(customerId, {
                expand: ['tax_ids'],
            });
        }
    }

    public subscriptions = {
        create: (subData: StripeSubscription) => {
            return this.stripeSdk.subscriptions.create({
                customer: subData.customer,
                items: [
                    {
                        "price": this.SUBSCRIPTION_PRICE,
                        "quantity": subData.subscriptions
                    }
                ],
                add_invoice_items: [
                    {
                        "price": this.TRACKER_PRICE,
                        "quantity": subData.trackers
                    }
                ],
                default_tax_rates: [
                    this.TAX_RATE_16
                ]
            })
        }
    }

    public products = {
        get: (productId: string) => {
            return this.stripeSdk.products.retrieve(productId);
        }
    }
}