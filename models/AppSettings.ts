import mongoose, { Document, Model, Schema } from 'mongoose'

export interface AppSettingsDoc extends Document {
    exchangeRateUSDToRiel: number
}

const appSettingsSchema = new Schema<AppSettingsDoc>(
    {
        exchangeRateUSDToRiel: { type: Number, required: true, min: 0 }
    },
    { timestamps: true }
)

const AppSettings: Model<AppSettingsDoc> =
    mongoose.models.AppSettings ||
    mongoose.model<AppSettingsDoc>('AppSettings', appSettingsSchema)

export default AppSettings