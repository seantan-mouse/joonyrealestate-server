import mongoose, { Document, Model, Schema, Types } from 'mongoose'

export interface ServiceAttrs {
    accountId?: Types.ObjectId
    buildingId: Types.ObjectId
    roomId?: Types.ObjectId | null
    name: string
    type?: string
    fee?: number
    date?: string
    notes?: string
    source?: string
}

export interface ServiceDoc extends Document {
    accountId?: Types.ObjectId
    buildingId: Types.ObjectId
    roomId: Types.ObjectId | null
    name: string
    type: string
    fee: number
    date: string
    notes: string
    source: string
    createdAt: Date
    updatedAt: Date
}

const serviceSchema = new Schema<ServiceDoc>(
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
            default: null,
            index: true
        },
        name: {
            type: String,
            required: true,
            trim: true
        },
        type: {
            type: String,
            default: 'general',
            trim: true
        },
        fee: {
            type: Number,
            default: 0,
            min: 0
        },
        date: {
            type: String,
            default: '',
            index: true
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
        collection: 'services'
    }
)

serviceSchema.index({ buildingId: 1, name: 1 })

const ServiceModel: Model<ServiceDoc> =
    mongoose.models.Service || mongoose.model<ServiceDoc>('Service', serviceSchema)

export default ServiceModel
