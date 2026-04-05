import { Types } from 'mongoose'
import Room from '../../models/Room'
import Stay from '../../models/Stay'
import MeterReading from '../../models/MeterReading'
import {
    asNumber,
    asTrimmedString,
    collectValidationErrors,
    requireDateString
} from '../common/validation'

type CreateReadingInput = {
    readingDate?: string
    electricity?: number
    water?: number
    notes?: string
}

export async function createReadingForRoom(roomId: string, input: CreateReadingInput) {
    if (!Types.ObjectId.isValid(roomId)) {
        return { status: 'room_not_found' as const }
    }

    const room = await Room.findById(roomId)
    if (!room) return { status: 'room_not_found' as const }

    const errors = collectValidationErrors([
        requireDateString(input.readingDate, 'readingDate')
    ])

    if (errors.length > 0) {
        return { status: 'invalid_reading_date' as const }
    }

    const readingDate = asTrimmedString(input.readingDate)

    const existing = await MeterReading.findOne({
        roomId: room._id,
        readingDate
    })

    if (existing) {
        return { status: 'duplicate_reading_date' as const }
    }

    const activeStay = await Stay.findOne({
        roomId: room._id,
        status: 'active'
    }).sort({ rentalStartDate: -1 })

    const reading = await MeterReading.create({
        accountId: room.accountId ?? undefined,
        buildingId: room.buildingId,
        roomId: room._id,
        stayId: activeStay?._id ?? null,
        readingDate,
        electricity: asNumber(input.electricity, 0),
        water: asNumber(input.water, 0),
        source: 'manual',
        notes: asTrimmedString(input.notes)
    })

    return { status: 'created' as const, reading }
}
