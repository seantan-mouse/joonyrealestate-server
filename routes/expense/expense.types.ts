import { Types } from 'mongoose'

export type LeanExpense = {
    _id: Types.ObjectId
    buildingId: Types.ObjectId
    roomId: Types.ObjectId | null
    name?: string
    type?: string
    date?: string
    amount?: number
    applyToRoomsType?: string
    selectedRoomIds?: Types.ObjectId[]
    notes?: string
    source?: string
}

export type LeanRoom = {
    _id: Types.ObjectId
    name: string
}

export type ExpenseDto = {
    _id: string
    buildingId: string
    roomId: string | null
    name: string
    type: string
    date: string
    amount: number
    applyToRoomsType: string
    selectedRooms: string[]
    notes: string
    source: string
}

export type CreateExpenseInput = {
    name?: string
    type?: string
    date?: string
    amount?: number
    applyToRoomsType?: string
    selectedRooms?: string[]
    notes?: string
}

export type UpdateExpenseInput = {
    name?: string
    type?: string
    date?: string
    amount?: number
    applyToRoomsType?: string
    selectedRooms?: string[]
    notes?: string
}