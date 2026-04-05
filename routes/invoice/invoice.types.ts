export type CreateInvoiceInput = {
    invoiceNo?: string
    date?: string
    billingPeriodStart?: string
    billingPeriodEnd?: string
    roomRate?: number
    nightlyRate?: number | null
    nights?: number | null
    stayStart?: string
    stayEnd?: string
    electricityReading?: number
    waterReading?: number
    others?: string
    othersFee?: number
    totalAmountRiel?: number
}