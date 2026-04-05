import mongoose, { Document, Model, Schema } from 'mongoose'

export interface CounterDoc extends Document {
    name: string
    value: number
}

const counterSchema = new Schema<CounterDoc>({
    name: { type: String, required: true, unique: true },
    value: { type: Number, required: true, default: 0 }
})

const Counter: Model<CounterDoc> =
    mongoose.models.Counter || mongoose.model<CounterDoc>('Counter', counterSchema)

export default Counter