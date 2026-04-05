import { Types } from 'mongoose'
import Room from '../../models/Room'
import Service from '../../models/Service'
import { getTodayIsoDate, toCanonicalIsoDate } from '../common/dates'
import {
    asNumber,
    asTrimmedString,
    collectValidationErrors,
    requireString
} from '../common/validation'
import type { CreateRoomServiceInput } from './service.types'

function normalizeDate(value: unknown): string {
    const raw = asTrimmedString(value)
    if (!raw) return getTodayIsoDate()

    return toCanonicalIsoDate(raw) || getTodayIsoDate()
}

export async function createServiceForRoom(roomId: string, input: CreateRoomServiceInput) {
    if (!Types.ObjectId.isValid(roomId)) {
        return { status: 'room_not_found' as const }
    }

    const room = await Room.findById(roomId)
    if (!room) return { status: 'room_not_found' as const }

    const errors = collectValidationErrors([
        requireString(input.name, 'name')
    ])

    if (errors.length > 0) {
        return { status: 'invalid_name' as const }
    }

    const service = await Service.create({
        accountId: room.accountId ?? undefined,
        buildingId: room.buildingId,
        roomId: room._id,
        name: asTrimmedString(input.name),
        type: asTrimmedString(input.type) || 'general',
        fee: asNumber(input.fee, 0),
        date: normalizeDate(input.date),
        notes: asTrimmedString(input.notes),
        source: 'manual'
    })

    return { status: 'created' as const, service }
}

export async function deleteServiceById(id: string) {
    if (!Types.ObjectId.isValid(id)) {
        return { status: 'service_not_found' as const }
    }

    const service = await Service.findById(id)
    if (!service) return { status: 'service_not_found' as const }

    await Service.deleteOne({ _id: id })

    return { status: 'deleted' as const }
}
