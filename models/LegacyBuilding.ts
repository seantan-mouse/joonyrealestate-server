import mongoose, { Document, Model, Schema } from 'mongoose'

export interface LegacyBuildingDoc extends Document {
    name?: string
    rooms?: Record<string, unknown>[]
    expenses?: Record<string, unknown>[]
    services?: Record<string, unknown>[]
    settings?: Record<string, unknown>
    notes?: string
}

const legacyBuildingSchema = new Schema<LegacyBuildingDoc>(
    {
        name: String,
        rooms: [Object],
        expenses: [Object],
        services: [Object],
        settings: Object,
        notes: String
    },
    {
        strict: false,
        collection: 'buildings_old'
    }
)

const LegacyBuildingModel: Model<LegacyBuildingDoc> =
    mongoose.models.LegacyBuilding ||
    mongoose.model<LegacyBuildingDoc>('LegacyBuilding', legacyBuildingSchema)

export default LegacyBuildingModel