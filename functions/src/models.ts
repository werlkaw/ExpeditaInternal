export type FacturamaCustomerTaxInfo = {
    Country: string
    Id: string
}

export type FacturamaReceiver = {
    Rfc: string
    Name: string
    CfdiUse: string
    TaxRegistrationNumber?: string
    TaxResidence?: string
}

export type Factura = {
    uuid: string,
    folio: string,
    total: string
}

export type FacturamaComplementoDePago = {
    receiver: {
        name: string,
        rfc: string
    }
    factura: Factura,
    paymentAmount: string,
    paymentDate: string 
}

export type FacturamaCdfiData = {
    Receiver: FacturamaReceiver,
    PaymentMethod: string,
    PaymentForm: string,
    items: FacturamaCfdiItem[]
} 

type FacturamaTax = {
    Total: string,
    Name: string,
    Base: string,
    Rate: string,
    IsRetention: string
}

export type FacturamaCfdiItem = {
    ProductCode: string,
    Description: string,
    UnitCode: string,
    UnitPrice: string,
    Quantity: string,
    Subtotal: string,
    Taxes: FacturamaTax[],
    Total: string
}

type TaxId = {
    type: string
    value: string
}

export type StripeCard = {
    number: string,
    exp_month: string,
    exp_year: string,
    cvc: string
}

export type Customer = {
    name: string
    description: string
    email: string
    invoice_settings?: object
    payment_method?: string
    tax_id_data?: TaxId[]
    metadata?: {}
}

export type StripeSubscription = {
    customer: string,
    trackers: number,
    subscriptions: number
}