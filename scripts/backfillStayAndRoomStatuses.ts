import 'dotenv/config'
import mongoose, { Types } from 'mongoose'

import Stay from '../models/Stay'
import Room, { type RoomStatus } from '../models/Room'
import { getEffectiveStayStatus } from '../routes/stay/stay.helpers'

type LeanStay = {
    _id: Types.ObjectId
    roomId: Types.ObjectId
    status?: string
    rentalStartDate?: string
    rentalEndDate?: string
    checkoutDate?: string
    cancelledAt?: string
    source?: string
}

type LeanRoom = {
    _id: Types.ObjectId
    status?: string
}

function normalizeRoomStatus(value?: string): RoomStatus {
    if (value === 'Occupied') return 'Occupied'
    if (value === 'Reserved') return 'Reserved'
    if (value === 'Maintenance') return 'Maintenance'
    return 'Vacant'
}

function toObjectIdString(value: Types.ObjectId): string {
    return value.toString()
}

function compareDateDesc(a?: string, b?: string): number {
    return String(b ?? '').localeCompare(String(a ?? ''))
}

function pickCurrentStay(stays: LeanStay[]): LeanStay | null {
    const sorted = stays
        .slice()
        .sort((a, b) => compareDateDesc(a.rentalStartDate, b.rentalStartDate))

    const active = sorted.find((stay) => getEffectiveStayStatus(stay) === 'active')
    if (active) return active

    const reserved = sorted.find((stay) => getEffectiveStayStatus(stay) === 'reserved')
    if (reserved) return reserved

    return null
}

function deriveRoomStatus(room: LeanRoom, currentStay: LeanStay | null): RoomStatus {
    const persisted = normalizeRoomStatus(room.status)

    if (persisted === 'Maintenance') {
        return 'Maintenance'
    }

    if (!currentStay) {
        return 'Vacant'
    }

    const stayStatus = getEffectiveStayStatus(currentStay)

    if (stayStatus === 'active') return 'Occupied'
    if (stayStatus === 'reserved') return 'Reserved'

    return 'Vacant'
}

async function main() {
    const mongoUri = process.env.MONGODB_URI

    if (!mongoUri) {
        throw new Error('MONGODB_URI is not set')
    }

    await mongoose.connect(mongoUri)
    console.log('[backfill] connected')

    try {
        const stays = (await Stay.find().lean()) as LeanStay[]
        const rooms = (await Room.find().lean()) as LeanRoom[]

        console.log(`[backfill] loaded ${stays.length} stays`)
        console.log(`[backfill] loaded ${rooms.length} rooms`)

        let stayUpdateCount = 0

        for (const stay of stays) {
            const nextStatus = getEffectiveStayStatus(stay)

            if (stay.status !== nextStatus) {
                await Stay.updateOne(
                    { _id: stay._id },
                    { $set: { status: nextStatus } }
                )

                stayUpdateCount += 1
            }
        }

        console.log(`[backfill] updated ${stayUpdateCount} stays`)

        const refreshedStays = (await Stay.find().lean()) as LeanStay[]
        const staysByRoomId = new Map<string, LeanStay[]>()

        for (const stay of refreshedStays) {
            const key = toObjectIdString(stay.roomId)
            const existing = staysByRoomId.get(key) ?? []
            existing.push(stay)
            staysByRoomId.set(key, existing)
        }

        let roomUpdateCount = 0

        for (const room of rooms) {
            const roomStays = staysByRoomId.get(toObjectIdString(room._id)) ?? []
            const currentStay = pickCurrentStay(roomStays)
            const nextRoomStatus = deriveRoomStatus(room, currentStay)

            if (room.status !== nextRoomStatus) {
                await Room.updateOne(
                    { _id: room._id },
                    { $set: { status: nextRoomStatus } }
                )

                roomUpdateCount += 1
            }
        }

        console.log(`[backfill] updated ${roomUpdateCount} rooms`)
        console.log('[backfill] completed')
    } finally {
        await mongoose.disconnect()
    }
}

void main().catch((error: unknown) => {
    console.error('[backfill] error:', error)
    process.exit(1)
})