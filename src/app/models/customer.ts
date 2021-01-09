
type CustomerInfo =  {
    name: string,
    email: string,
    description: string,
    rfc?: string,
    cfdiUse?: string
}

type CardDetails = {
    number: string,
    month: string,
    year: string,
    cvv: string
}

export type CustomerData = {
    customer: CustomerInfo,
    tracker_quantity: number,
    livemode: boolean,
    card_details?: CardDetails,
}