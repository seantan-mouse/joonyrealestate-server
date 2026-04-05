import mongoose, { Document, Model, Schema, Types } from 'mongoose'

export type StayType = 'monthly' | 'daily' | 'contract'
export type StayStatus = 'reserved' | 'active' | 'checked_out' | 'cancelled'

export interface StayAttrs {
    accountId?: Types.ObjectId
    buildingId: Types.ObjectId
    roomId: Types.ObjectId
    tenantId: Types.ObjectId
    legacyBuildingId?: string
    legacyRoomId?: string
    legacyTenantRoomNo?: string
    type?: StayType
    status?: StayStatus
    rentalStartDate?: string
    rentalEndDate?: string
    checkoutDate?: string
    cancelledAt?: string
    roomRate?: number
    depositAmount?: number
    electricityRate?: number
    waterRate?: number
    electricityMeterStartAt?: number
    waterMeterStartAt?: number
    notes?: string
    source?: string
}

export interface StayDoc extends Document {
    accountId?: Types.ObjectId
    buildingId: Types.ObjectId
    roomId: Types.ObjectId
    tenantId: Types.ObjectId
    legacyBuildingId: string
    legacyRoomId: string
    legacyTenantRoomNo: string
    type: StayType
    status: StayStatus
    rentalStartDate: string
    rentalEndDate: string
    checkoutDate: string
    cancelledAt: string
    roomRate: number
    depositAmount: number
    electricityRate: number
    waterRate: number
    electricityMeterStartAt: number
    waterMeterStartAt: number
    notes: string
    source: string
    createdAt: Date
    updatedAt: Date
}

const staySchema = new Schema<StayDoc>(
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
        tenantId: {
            type: Schema.Types.ObjectId,
            ref: 'Tenant',
            required: true,
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
        legacyTenantRoomNo: {
            type: String,
            default: ''
        },
        type: {
            type: String,
            enum: ['monthly', 'daily', 'contract'],
            default: 'monthly'
        },
        status: {
            type: String,
            enum: ['reserved', 'active', 'checked_out', 'cancelled'],
            required: true,
            default: 'active',
            index: true
        },
        rentalStartDate: {
            type: String,
            default: '',
            index: true
        },
        rentalEndDate: {
            type: String,
            default: ''
        },
        checkoutDate: {
            type: String,
            default: ''
        },
        cancelledAt: {
            type: String,
            default: ''
        },
        roomRate: {
            type: Number,
            default: 0,
            min: 0
        },
        depositAmount: {
            type: Number,
            default: 0,
            min: 0
        },
        electricityRate: {
            type: Number,
            default: 0,
            min: 0
        },
        waterRate: {
            type: Number,
            default: 0,
            min: 0
        },
        electricityMeterStartAt: {
            type: Number,
            default: 0,
            min: 0
        },
        waterMeterStartAt: {
            type: Number,
            default: 0,
            min: 0
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
        collection: 'stays'
    }
)

staySchema.index({ roomId: 1, status: 1 })
staySchema.index({ tenantId: 1, rentalStartDate: 1 })

const StayModel: Model<StayDoc> =
    mongoose.models.Stay || mongoose.model<StayDoc>('Stay', staySchema)

export default StayModel
