import mongoose, { Document, Model, Schema, Types } from 'mongoose'

export type MeterReadingSource = 'migration' | 'manual' | 'system'

export interface MeterReadingAttrs {
    accountId?: Types.ObjectId
    buildingId: Types.ObjectId
    roomId: Types.ObjectId
    stayId?: Types.ObjectId | null
    legacyBuildingId?: string
    legacyRoomId?: string
    readingDate: string
    electricity?: number
    water?: number
    source?: MeterReadingSource
    notes?: string
}

export interface MeterReadingDoc extends Document {
    accountId?: Types.ObjectId
    buildingId: Types.ObjectId
    roomId: Types.ObjectId
    stayId: Types.ObjectId | null
    legacyBuildingId: string
    legacyRoomId: string
    readingDate: string
    electricity: number
    water: number
    source: MeterReadingSource
    notes: string
    createdAt: Date
    updatedAt: Date
}

const meterReadingSchema = new Schema<MeterReadingDoc>(
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
        readingDate: {
            type: String,
            required: true,
            default: '',
            index: true
        },
        electricity: {
            type: Number,
            default: 0
        },
        water: {
            type: Number,
            default: 0
        },
        source: {
            type: String,
            enum: ['migration', 'manual', 'system'],
            default: 'migration'
        },
        notes: {
            type: String,
            default: ''
        }
    },
    {
        timestamps: true,
        collection: 'meterreadings'
    }
)

meterReadingSchema.index(
    { roomId: 1, readingDate: 1, electricity: 1, water: 1 },
    { name: 'room_reading_dedupe_lookup' }
)

const MeterReadingModel: Model<MeterReadingDoc> =
    mongoose.models.MeterReading ||
    mongoose.model<MeterReadingDoc>('MeterReading', meterReadingSchema)

export default MeterReadingModel
