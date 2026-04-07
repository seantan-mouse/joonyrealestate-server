import mongoose, { Document, Model, Schema, Types } from 'mongoose'

export interface BuildingSettings {
    roomsPerRow: number
    interestRate: number
}

export interface BuildingAttrs {
    accountId?: Types.ObjectId
    name: string
    code?: string
    notes?: string
    settings?: Partial<BuildingSettings>
    isActive?: boolean
    legacyBuildingId?: string
}

export interface BuildingDoc extends Document {
    accountId?: Types.ObjectId
    name: string
    code: string
    notes: string
    settings: BuildingSettings
    isActive: boolean
    legacyBuildingId: string
    createdAt: Date
    updatedAt: Date
}

const buildingSchema = new Schema<BuildingDoc>(
    {
        accountId: {
            type: Schema.Types.ObjectId,
            ref: 'Account',
            index: true
        },
        name: {
            type: String,
            required: true,
            trim: true
        },
        code: {
            type: String,
            trim: true,
            default: ''
        },
        notes: {
            type: String,
            default: ''
        },
        settings: {
            roomsPerRow: {
                type: Number,
                default: 8,
                min: 1
            },
            interestRate: {
                type: Number,
                default: 0,
                min: 0
            }
        },
        isActive: {
            type: Boolean,
            default: true
        },
        legacyBuildingId: {
            type: String,
            default: '',
            index: true
        }
    },
    {
        timestamps: true,
        collection: 'buildings'
    }
)

buildingSchema.index({ accountId: 1, name: 1 }, { unique: true })

const BuildingModel: Model<BuildingDoc> =
    mongoose.models.Building || mongoose.model<BuildingDoc>('Building', buildingSchema)

export default BuildingModel
