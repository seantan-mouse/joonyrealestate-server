import { Types } from 'mongoose'
import Expense from '../../models/Expense'
import Building from '../../models/Building'
import Room from '../../models/Room'
import type {
    CreateExpenseInput,
    ExpenseDto,
    LeanExpense,
    LeanRoom,
    UpdateExpenseInput
} from './expense.types'

function toObjectIdString(value: Types.ObjectId | string | null | undefined): string {
    if (value instanceof Types.ObjectId) return value.toString()
    return String(value ?? '')
}

function toStringValue(value: unknown): string {
    if (value === null || value === undefined) return ''
    return String(value).trim()
}

function toNumber(value: unknown, fallback = 0): number {
    const num = Number(value)
    return Number.isFinite(num) ? num : fallback
}

function buildRoomNameMap(rooms: LeanRoom[]): Map<string, string> {
    return new Map(rooms.map((room) => [toObjectIdString(room._id), room.name]))
}

function buildRoomIdMap(rooms: LeanRoom[]): Map<string, Types.ObjectId> {
    return new Map(rooms.map((room) => [room.name, room._id]))
}

function mapExpenseDto(expense: LeanExpense, roomNameById: Map<string, string>): ExpenseDto {
    const selectedRooms = Array.isArray(expense.selectedRoomIds)
        ? expense.selectedRoomIds
              .map((roomId) => roomNameById.get(toObjectIdString(roomId)) ?? '')
              .filter(Boolean)
        : []

    return {
        _id: toObjectIdString(expense._id),
        buildingId: toObjectIdString(expense.buildingId),
        roomId: expense.roomId ? toObjectIdString(expense.roomId) : null,
        name: toStringValue(expense.name),
        type: toStringValue(expense.type),
        date: toStringValue(expense.date),
        amount: toNumber(expense.amount, 0),
        applyToRoomsType: toStringValue(expense.applyToRoomsType),
        selectedRooms,
        notes: toStringValue(expense.notes),
        source: toStringValue(expense.source)
    }
}

function requireObjectId(id: string): Types.ObjectId | null {
    if (!Types.ObjectId.isValid(id)) return null
    return new Types.ObjectId(id)
}

function normalizeSelectedRoomIds(selectedRooms: string[] | undefined, roomIdByName: Map<string, Types.ObjectId>): Types.ObjectId[] {
    if (!Array.isArray(selectedRooms)) return []

    return selectedRooms
        .map((roomName) => roomIdByName.get(String(roomName).trim()))
        .filter((roomId): roomId is Types.ObjectId => roomId instanceof Types.ObjectId)
}

export async function listExpensesByBuildingId(buildingId: string): Promise<ExpenseDto[] | null> {
    const objectId = requireObjectId(buildingId)
    if (!objectId) return null

    const building = await Building.findById(objectId).lean<{ _id: Types.ObjectId; accountId?: Types.ObjectId } | null>()
    if (!building) return null

    const [expenses, rooms] = await Promise.all([
        Expense.find({ buildingId: objectId }).sort({ date: -1, createdAt: -1 }).lean<LeanExpense[]>(),
        Room.find({ buildingId: objectId }).lean<LeanRoom[]>()
    ])

    const roomNameById = buildRoomNameMap(rooms)

    return expenses.map((expense) => mapExpenseDto(expense, roomNameById))
}

export async function createExpenseForBuilding(buildingId: string, input: CreateExpenseInput) {
    const objectId = requireObjectId(buildingId)
    if (!objectId) return { status: 'building_not_found' as const }

    const building = await Building.findById(objectId).lean<{ _id: Types.ObjectId; accountId?: Types.ObjectId } | null>()
    if (!building) return { status: 'building_not_found' as const }

    const name = toStringValue(input.name)
    if (!name) return { status: 'invalid_name' as const }

    const date = toStringValue(input.date)
    if (!date) return { status: 'invalid_date' as const }

    const amount = toNumber(input.amount, 0)
    if (amount <= 0) return { status: 'invalid_amount' as const }

    const rooms = await Room.find({ buildingId: objectId }).lean<LeanRoom[]>()
    const roomIdByName = buildRoomIdMap(rooms)
    const roomNameById = buildRoomNameMap(rooms)

    const selectedRoomIds = normalizeSelectedRoomIds(input.selectedRooms, roomIdByName)

    const expense = await Expense.create({
        accountId: building.accountId ?? undefined,
        buildingId: objectId,
        roomId: null,
        name,
        type: toStringValue(input.type) || 'general',
        date,
        amount,
        applyToRoomsType: toStringValue(input.applyToRoomsType) || 'general-expense',
        selectedRoomIds,
        notes: toStringValue(input.notes),
        source: 'manual'
    })

    const dto = mapExpenseDto(expense.toObject() as LeanExpense, roomNameById)

    return {
        status: 'created' as const,
        expense: dto
    }
}

export async function updateExpenseById(id: string, input: UpdateExpenseInput) {
    const objectId = requireObjectId(id)
    if (!objectId) return { status: 'expense_not_found' as const }

    const expense = await Expense.findById(objectId)
    if (!expense) return { status: 'expense_not_found' as const }

    const name = toStringValue(input.name)
    if (!name) return { status: 'invalid_name' as const }

    const date = toStringValue(input.date)
    if (!date) return { status: 'invalid_date' as const }

    const amount = toNumber(input.amount, 0)
    if (amount <= 0) return { status: 'invalid_amount' as const }

    const rooms = await Room.find({ buildingId: expense.buildingId }).lean<LeanRoom[]>()
    const roomIdByName = buildRoomIdMap(rooms)
    const roomNameById = buildRoomNameMap(rooms)

    expense.name = name
    expense.type = toStringValue(input.type) || 'general'
    expense.date = date
    expense.amount = amount
    expense.applyToRoomsType = toStringValue(input.applyToRoomsType) || 'general-expense'
    expense.selectedRoomIds = normalizeSelectedRoomIds(input.selectedRooms, roomIdByName)
    expense.notes = toStringValue(input.notes)

    await expense.save()

    const dto = mapExpenseDto(expense.toObject() as LeanExpense, roomNameById)

    return {
        status: 'updated' as const,
        expense: dto
    }
}

export async function deleteExpenseById(id: string): Promise<boolean> {
    const objectId = requireObjectId(id)
    if (!objectId) return false

    const result = await Expense.deleteOne({ _id: objectId })
    return result.deletedCount > 0
}
