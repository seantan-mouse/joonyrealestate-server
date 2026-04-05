import mongoose, { Document, Model, Schema, Types } from 'mongoose'

export interface ExpenseAttrs {
    accountId?: Types.ObjectId
    buildingId: Types.ObjectId
    roomId?: Types.ObjectId | null
    name: string
    type?: string
    date: string
    amount: number
    applyToRoomsType?: string
    selectedRoomIds?: Types.ObjectId[]
    notes?: string
    source?: string
}

export interface ExpenseDoc extends Document {
    accountId?: Types.ObjectId
    buildingId: Types.ObjectId
    roomId: Types.ObjectId | null
    name: string
    type: string
    date: string
    amount: number
    applyToRoomsType: string
    selectedRoomIds: Types.ObjectId[]
    notes: string
    source: string
    createdAt: Date
    updatedAt: Date
}

const expenseSchema = new Schema<ExpenseDoc>(
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
        date: {
            type: String,
            required: true,
            default: '',
            index: true
        },
        amount: {
            type: Number,
            required: true,
            min: 0
        },
        applyToRoomsType: {
            type: String,
            default: 'general-expense',
            trim: true
        },
        selectedRoomIds: [
            {
                type: Schema.Types.ObjectId,
                ref: 'Room'
            }
        ],
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
        collection: 'expenses'
    }
)

expenseSchema.index({ buildingId: 1, date: 1 })

const ExpenseModel: Model<ExpenseDoc> =
    mongoose.models.Expense || mongoose.model<ExpenseDoc>('Expense', expenseSchema)

export default ExpenseModel
