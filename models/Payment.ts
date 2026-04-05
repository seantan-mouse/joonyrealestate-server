import mongoose, { Document, Model, Schema, Types } from 'mongoose'

export type PaymentType = 'full' | 'partial'
export type PaymentMethod = 'cash' | 'bank' | 'khqr' | 'card' | 'other'

export interface PaymentAttrs {
    accountId?: Types.ObjectId
    invoiceId: Types.ObjectId
    buildingId: Types.ObjectId
    roomId: Types.ObjectId
    stayId?: Types.ObjectId | null
    tenantId?: Types.ObjectId | null
    paymentDate: string
    amount: number
    type: PaymentType
    method?: PaymentMethod
    notes?: string
    source?: string
}

export interface PaymentDoc extends Document {
    accountId?: Types.ObjectId
    invoiceId: Types.ObjectId
    buildingId: Types.ObjectId
    roomId: Types.ObjectId
    stayId: Types.ObjectId | null
    tenantId: Types.ObjectId | null
    paymentDate: string
    amount: number
    type: PaymentType
    method: PaymentMethod
    notes: string
    source: string
    createdAt: Date
    updatedAt: Date
}

const paymentSchema = new Schema<PaymentDoc>(
    {
        accountId: {
            type: Schema.Types.ObjectId,
            ref: 'Account',
            index: true
        },
        invoiceId: {
            type: Schema.Types.ObjectId,
            ref: 'Invoice',
            required: true,
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
        paymentDate: {
            type: String,
            required: true,
            index: true
        },
        amount: {
            type: Number,
            required: true,
            min: 0
        },
        type: {
            type: String,
            enum: ['full', 'partial'],
            required: true
        },
        method: {
            type: String,
            enum: ['cash', 'bank', 'khqr', 'card', 'other'],
            default: 'cash'
        },
        notes: {
            type: String,
            default: ''
        },
        source: {
            type: String,
            default: 'migration'
        }
    },
    {
        timestamps: true,
        collection: 'payments'
    }
)

paymentSchema.index({ invoiceId: 1, paymentDate: 1, amount: 1 })

const PaymentModel: Model<PaymentDoc> =
    mongoose.models.Payment || mongoose.model<PaymentDoc>('Payment', paymentSchema)

export default PaymentModel
