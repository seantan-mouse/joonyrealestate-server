import mongoose, { Document, Model, Schema, Types } from 'mongoose'
import type { TenantCurrency, TenantLanguage } from './Tenant'

export type InvoiceStatus = 'Paid' | 'Not paid' | 'Partially paid' | 'Voided'

export interface InvoiceAttrs {
    accountId?: Types.ObjectId
    buildingId: Types.ObjectId
    roomId: Types.ObjectId
    stayId?: Types.ObjectId | null
    tenantId?: Types.ObjectId | null
    legacyBuildingId?: string
    legacyRoomId?: string
    invoiceNo: string
    date: string
    billingPeriodStart?: string
    billingPeriodEnd?: string
    roomRate?: number
    nightlyRate?: number | null
    nights?: number | null
    stayStart?: string
    stayEnd?: string
    electricityRate?: number
    waterRate?: number
    oldElectricityReading?: number
    electricityReading?: number
    electricityPrice?: number
    oldWaterReading?: number
    waterReading?: number
    waterPrice?: number
    services?: string
    servicesFee?: number
    others?: string
    othersFee?: number
    previousBalance?: number
    totalAmount?: number
    totalAmountRiel?: number
    status?: InvoiceStatus
    outstandingAmount?: number
    tenantNameSnapshot?: string
    tenantPhoneSnapshot?: string
    tenantLanguageSnapshot?: TenantLanguage
    tenantCurrencySnapshot?: TenantCurrency
    tenantCheckInDateSnapshot?: string
}

export interface InvoiceDoc extends Document {
    accountId?: Types.ObjectId
    buildingId: Types.ObjectId
    roomId: Types.ObjectId
    stayId: Types.ObjectId | null
    tenantId: Types.ObjectId | null
    legacyBuildingId: string
    legacyRoomId: string
    invoiceNo: string
    date: string
    billingPeriodStart: string
    billingPeriodEnd: string
    roomRate: number
    nightlyRate: number | null
    nights: number | null
    stayStart: string
    stayEnd: string
    electricityRate: number
    waterRate: number
    oldElectricityReading: number
    electricityReading: number
    electricityPrice: number
    oldWaterReading: number
    waterReading: number
    waterPrice: number
    services: string
    servicesFee: number
    others: string
    othersFee: number
    previousBalance: number
    totalAmount: number
    totalAmountRiel: number
    status: InvoiceStatus
    outstandingAmount: number
    tenantNameSnapshot: string
    tenantPhoneSnapshot: string
    tenantLanguageSnapshot: TenantLanguage
    tenantCurrencySnapshot: TenantCurrency
    tenantCheckInDateSnapshot: string
    createdAt: Date
    updatedAt: Date
}

const invoiceSchema = new Schema<InvoiceDoc>(
    {
        accountId: {
            type: Schema.Types.ObjectId,
            ref: 'Account',
            index: true
        },
        buildingId: {
            type: Schema.Types.ObjectId,
            ref: 'Building',
            required: true,
            index: true
        },
        roomId: {
            type: Schema.Types.ObjectId,
            ref: 'Room',
            required: true,
            index: true
        },
        stayId: {
            type: Schema.Types.ObjectId,
            ref: 'Stay',
            default: null,
            index: true
        },
        tenantId: {
            type: Schema.Types.ObjectId,
            ref: 'Tenant',
            default: null,
            index: true
        },
        legacyBuildingId: {
            type: String,
            default: '',
            index: true
        },
        legacyRoomId: {
            type: String,
            default: '',
            index: true
        },
        invoiceNo: {
            type: String,
            required: true,
            trim: true
        },
        date: {
            type: String,
            required: true,
            default: '',
            index: true
        },
        billingPeriodStart: {
            type: String,
            default: ''
        },
        billingPeriodEnd: {
            type: String,
            default: ''
        },
        roomRate: {
            type: Number,
            default: 0
        },
        nightlyRate: {
            type: Number,
            default: null
        },
        nights: {
            type: Number,
            default: null
        },
        stayStart: {
            type: String,
            default: ''
        },
        stayEnd: {
            type: String,
            default: ''
        },
        electricityRate: {
            type: Number,
            default: 0
        },
        waterRate: {
            type: Number,
            default: 0
        },
        oldElectricityReading: {
            type: Number,
            default: 0
        },
        electricityReading: {
            type: Number,
            default: 0
        },
        electricityPrice: {
            type: Number,
            default: 0
        },
        oldWaterReading: {
            type: Number,
            default: 0
        },
        waterReading: {
            type: Number,
            default: 0
        },
        waterPrice: {
            type: Number,
            default: 0
        },
        services: {
            type: String,
            default: ''
        },
        servicesFee: {
            type: Number,
            default: 0
        },
        others: {
            type: String,
            default: ''
        },
        othersFee: {
            type: Number,
            default: 0
        },
        previousBalance: {
            type: Number,
            default: 0
        },
        totalAmount: {
            type: Number,
            default: 0
        },
        totalAmountRiel: {
            type: Number,
            default: 0
        },
        status: {
            type: String,
            enum: ['Paid', 'Not paid', 'Partially paid', 'Voided'],
            default: 'Not paid',
            index: true
        },
        outstandingAmount: {
            type: Number,
            default: 0
        },
        tenantNameSnapshot: {
            type: String,
            default: ''
        },
        tenantPhoneSnapshot: {
            type: String,
            default: ''
        },
        tenantLanguageSnapshot: {
            type: String,
            enum: ['english', 'khmer', 'chinese', 'japanese', 'korean'],
            default: 'english'
        },
        tenantCurrencySnapshot: {
            type: String,
            enum: ['USD', 'Riel'],
            default: 'USD'
        },
        tenantCheckInDateSnapshot: {
            type: String,
            default: ''
        }
    },
    {
        timestamps: true,
        collection: 'invoices'
    }
)

invoiceSchema.index({ invoiceNo: 1, roomId: 1 }, { unique: true })
invoiceSchema.index({ roomId: 1, date: 1 })

const InvoiceModel: Model<InvoiceDoc> =
    mongoose.models.Invoice || mongoose.model<InvoiceDoc>('Invoice', invoiceSchema)

export default InvoiceModel
