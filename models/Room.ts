import mongoose, { Document, Model, Schema, Types } from 'mongoose'

export type RoomStatus = 'Vacant' | 'Occupied' | 'Reserved' | 'Maintenance'

export interface RoomAttrs {
    accountId?: Types.ObjectId
    buildingId: Types.ObjectId
    legacyBuildingId?: string
    legacyRoomId?: string
    name: string
    roomType?: string
    floor?: number | null
    status?: RoomStatus
    defaultRoomRate?: number
    notes?: string
    isActive?: boolean
}

export interface RoomDoc extends Document {
    accountId?: Types.ObjectId
    buildingId: Types.ObjectId
    legacyBuildingId: string
    legacyRoomId: string
    name: string
    roomType: string
    floor: number | null
    status: RoomStatus
    defaultRoomRate: number
    notes: string
    isActive: boolean
    createdAt: Date
    updatedAt: Date
}

const roomSchema = new Schema<RoomDoc>(
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
        name: {
            type: String,
            required: true,
            trim: true
        },
        roomType: {
            type: String,
            default: 'standard'
        },
        floor: {
            type: Number,
            default: null
        },
        status: {
            type: String,
            enum: ['Vacant', 'Occupied', 'Reserved', 'Maintenance'],
            default: 'Vacant',
            index: true
        },
        defaultRoomRate: {
            type: Number,
            default: 0,
            min: 0
        },
        notes: {
            type: String,
            default: ''
        },
        isActive: {
            type: Boolean,
            default: true
        }
    },
    {
        timestamps: true,
        collection: 'rooms'
    }
)

roomSchema.index({ buildingId: 1, name: 1 }, { unique: true })

const RoomModel: Model<RoomDoc> =
    mongoose.models.Room || mongoose.model<RoomDoc>('Room', roomSchema)

export default RoomModel
