import 'dotenv/config'
import mongoose, { Types } from 'mongoose'

import Room from '../models/Room'
import Stay from '../models/Stay'

type LeanRoom = {
    _id: Types.ObjectId
    buildingId: Types.ObjectId
    name: string
    status?: string
}

type LeanStay = {
    _id: Types.ObjectId
    roomId: Types.ObjectId
    tenantId: Types.ObjectId
    status?: string
    rentalStartDate?: string
    rentalEndDate?: string
    checkoutDate?: string
    cancelledAt?: string
}

type RoomStatus = 'Vacant' | 'Occupied' | 'Reserved' | 'Maintenance'
type StayStatus = 'reserved' | 'active' | 'checked_out' | 'cancelled'

const BUILDING_RULES = [
    {
        buildingId: '69b52ae350ad6cc3d44295a5',
        vacantRooms: new Set(['101', '103', '302', '405', '703', 'Family Room'])
    },
    {
        buildingId: '69b5271650ad6cc3d4429505',
        vacantRooms: new Set(['01', '02', '04', '29', '32', '46', '48', '52'])
    }
]

function today(): string {
    return new Date().toISOString().slice(0, 10)
}

function compareDateDesc(a?: string, b?: string): number {
    return String(b ?? '').localeCompare(String(a ?? ''))
}

function normalizeRoomStatus(value?: string): RoomStatus {
    if (value === 'Occupied') return 'Occupied'
    if (value === 'Reserved') return 'Reserved'
    if (value === 'Maintenance') return 'Maintenance'
    return 'Vacant'
}

function normalizeStayStatus(value?: string): StayStatus | '' {
    const s = String(value ?? '').trim().toLowerCase()

    if (s === 'reserved') return 'reserved'
    if (s === 'active') return 'active'
    if (s === 'checked_out') return 'checked_out'
    if (s === 'cancelled') return 'cancelled'

    return ''
}

function getEffectiveStayStatus(stay: LeanStay): StayStatus {
    const currentDate = today()
    const cancelledAt = String(stay.cancelledAt ?? '').trim()
    const checkoutDate = String(stay.checkoutDate ?? '').trim()
    const rentalStartDate = String(stay.rentalStartDate ?? '').trim()
    const rentalEndDate = String(stay.rentalEndDate ?? '').trim()
    const persisted = normalizeStayStatus(stay.status)

    if (cancelledAt) return 'cancelled'
    if (checkoutDate) return 'checked_out'
    if (rentalStartDate && rentalStartDate > currentDate) return 'reserved'
    if (rentalEndDate && rentalEndDate < currentDate) return 'checked_out'

    if (persisted === 'reserved') return 'reserved'
    return 'active'
}

async function main() {
    const mongoUri = process.env.MONGODB_URI

    if (!mongoUri) {
        throw new Error('MONGODB_URI is not set')
    }

    await mongoose.connect(mongoUri)
    console.log('[manual-occupancy] connected')

    try {
        let updatedRooms = 0
        let updatedStays = 0

        for (const rule of BUILDING_RULES) {
            const buildingObjectId = new Types.ObjectId(rule.buildingId)

            const rooms = (await Room.find({ buildingId: buildingObjectId }).lean()) as LeanRoom[]
            const roomIds = rooms.map((room) => room._id)
            const stays = (await Stay.find({ roomId: { $in: roomIds } }).lean()) as LeanStay[]

            const staysByRoomId = new Map<string, LeanStay[]>()

            for (const stay of stays) {
                const key = String(stay.roomId)
                const existing = staysByRoomId.get(key) ?? []
                existing.push(stay)
                staysByRoomId.set(key, existing)
            }

            for (const room of rooms) {
                const shouldBeVacant = rule.vacantRooms.has(room.name)
                const roomStays = (staysByRoomId.get(String(room._id)) ?? [])
                    .slice()
                    .sort((a, b) => compareDateDesc(a.rentalStartDate, b.rentalStartDate))

                const currentLikeStays = roomStays.filter((stay) => {
                    const status = getEffectiveStayStatus(stay)
                    return status === 'active' || status === 'reserved'
                })

                if (shouldBeVacant) {
                    for (const stay of currentLikeStays) {
                        await Stay.updateOne(
                            { _id: stay._id },
                            {
                                $set: {
                                    status: 'checked_out',
                                    checkoutDate: String(stay.checkoutDate ?? '').trim() || today()
                                }
                            }
                        )
                        updatedStays += 1
                    }

                    if (normalizeRoomStatus(room.status) !== 'Vacant') {
                        await Room.updateOne(
                            { _id: room._id },
                            { $set: { status: 'Vacant' } }
                        )
                        updatedRooms += 1
                    }

                    console.log('[manual-occupancy] forced vacant', room.name)
                    continue
                }

                if (currentLikeStays.length > 1) {
                    const [winner, ...losers] = currentLikeStays

                    for (const loser of losers) {
                        await Stay.updateOne(
                            { _id: loser._id },
                            {
                                $set: {
                                    status: 'checked_out',
                                    checkoutDate: String(loser.checkoutDate ?? '').trim() || today()
                                }
                            }
                        )
                        updatedStays += 1
                    }

                    if (getEffectiveStayStatus(winner) !== 'active') {
                        await Stay.updateOne(
                            { _id: winner._id },
                            {
                                $set: {
                                    status: 'active',
                                    checkoutDate: '',
                                    cancelledAt: ''
                                }
                            }
                        )
                        updatedStays += 1
                    }
                } else if (currentLikeStays.length === 0) {
                    const latestStay = roomStays[0]

                    if (latestStay) {
                        await Stay.updateOne(
                            { _id: latestStay._id },
                            {
                                $set: {
                                    status: 'active',
                                    checkoutDate: '',
                                    cancelledAt: '',
                                    rentalEndDate:
                                        String(latestStay.rentalEndDate ?? '').trim() < today()
                                            ? ''
                                            : String(latestStay.rentalEndDate ?? '').trim()
                                }
                            }
                        )
                        updatedStays += 1
                        console.log('[manual-occupancy] revived latest stay as active', room.name)
                    } else {
                        console.log('[manual-occupancy] no stay history to revive', room.name)
                    }
                } else {
                    const onlyCurrent = currentLikeStays[0]

                    if (getEffectiveStayStatus(onlyCurrent) !== 'active') {
                        await Stay.updateOne(
                            { _id: onlyCurrent._id },
                            {
                                $set: {
                                    status: 'active',
                                    checkoutDate: '',
                                    cancelledAt: ''
                                }
                            }
                        )
                        updatedStays += 1
                    }
                }

                if (normalizeRoomStatus(room.status) !== 'Occupied') {
                    await Room.updateOne(
                        { _id: room._id },
                        { $set: { status: 'Occupied' } }
                    )
                    updatedRooms += 1
                }
            }
        }

        console.log('[manual-occupancy] updated stays =', updatedStays)
        console.log('[manual-occupancy] updated rooms =', updatedRooms)
        console.log('[manual-occupancy] completed')
    } finally {
        await mongoose.disconnect()
    }
}

void main().catch((error: unknown) => {
    console.error('[manual-occupancy] error:', error)
    process.exit(1)
})