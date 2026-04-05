import 'dotenv/config'
import mongoose, { Types } from 'mongoose'

import LegacyBuilding from '../models/LegacyBuilding'
import Building from '../models/Building'
import Room, { type RoomStatus } from '../models/Room'
import Stay, { type StayStatus } from '../models/Stay'
import Tenant from '../models/Tenant'

type LegacyRecord = Record<string, unknown>

type LegacyTenant = LegacyRecord & {
    name?: unknown
    email?: unknown
    phone?: unknown
    country?: unknown
    gender?: unknown
    language?: unknown
    currency?: unknown
    rentalType?: unknown
    dateOfBirth?: unknown
    identityNo?: unknown
    passportExpiryDate?: unknown
    visaExpiryDate?: unknown
    address?: unknown
    notes?: unknown
    roomNo?: unknown
    rentalStartDate?: unknown
    rentalEndDate?: unknown
    checkoutDate?: unknown
    roomRate?: unknown
    depositAmount?: unknown
    electricityRate?: unknown
    waterRate?: unknown
    electricityMeterStartAt?: unknown
    waterMeterStartAt?: unknown
}

type LegacyRoom = LegacyRecord & {
    id?: unknown
    name?: unknown
    roomNo?: unknown
    roomId?: unknown
    status?: unknown
    roomRate?: unknown
    notes?: unknown
    tenant?: unknown
    tenants?: unknown
}

type LegacyBuildingShape = {
    _id: Types.ObjectId
    name?: unknown
    rooms?: unknown
}

type LeanRoom = {
    _id: Types.ObjectId
    buildingId: Types.ObjectId
    legacyBuildingId?: string
    legacyRoomId?: string
    name: string
    status?: string
    defaultRoomRate?: number
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

type LeanTenant = {
    _id: Types.ObjectId
    fullName?: string
    phone?: string
    dateOfBirth?: string
}

function asRecord(value: unknown): LegacyRecord | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    return value as LegacyRecord
}

function asRecordArray<T extends LegacyRecord = LegacyRecord>(value: unknown): T[] {
    if (!Array.isArray(value)) return []
    return value.filter((item) => !!item && typeof item === 'object' && !Array.isArray(item)) as T[]
}

function asString(value: unknown): string {
    if (value === null || value === undefined) return ''
    return String(value).trim()
}

function asNumber(value: unknown): number {
    if (value === null || value === undefined || value === '') return 0
    const num = Number(value)
    return Number.isFinite(num) ? num : 0
}

function normalizeDate(value: unknown): string {
    if (!value) return ''
    const str = String(value).trim()
    if (!str) return ''

    const date = new Date(str)

    if (Number.isNaN(date.getTime())) {
        return str
    }

    return date.toISOString().slice(0, 10)
}

function normalizeRoomStatus(value?: string): RoomStatus {
    if (value === 'Occupied') return 'Occupied'
    if (value === 'Reserved') return 'Reserved'
    if (value === 'Maintenance') return 'Maintenance'
    return 'Vacant'
}

function normalizeLegacyRoomStatus(value: unknown): RoomStatus {
    const status = asString(value)

    if (status === 'Occupied') return 'Occupied'
    if (status === 'Reserved') return 'Reserved'
    if (status === 'Maintenance') return 'Maintenance'
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

function getEffectiveStayStatus(stay: {
    status?: string
    rentalStartDate?: string
    rentalEndDate?: string
    checkoutDate?: string
    cancelledAt?: string
}): StayStatus {
    const today = new Date().toISOString().slice(0, 10)

    const cancelledAt = normalizeDate(stay.cancelledAt)
    const checkoutDate = normalizeDate(stay.checkoutDate)
    const rentalStartDate = normalizeDate(stay.rentalStartDate)
    const rentalEndDate = normalizeDate(stay.rentalEndDate)
    const persisted = normalizeStayStatus(stay.status)

    if (cancelledAt) return 'cancelled'
    if (checkoutDate) return 'checked_out'
    if (rentalStartDate && rentalStartDate > today) return 'reserved'
    if (rentalEndDate && rentalEndDate < today) return 'checked_out'

    if (persisted === 'reserved') return 'reserved'
    return 'active'
}

function compareDateDesc(a?: string, b?: string): number {
    return String(b ?? '').localeCompare(String(a ?? ''))
}

function buildTenantKeyFromLegacy(tenant: LegacyTenant): string {
    return [
        asString(tenant.name).toLowerCase(),
        asString(tenant.phone),
        normalizeDate(tenant.dateOfBirth)
    ].join('::')
}

function buildTenantKeyFromTenantDoc(tenant: LeanTenant): string {
    return [
        asString(tenant.fullName).toLowerCase(),
        asString(tenant.phone),
        normalizeDate(tenant.dateOfBirth)
    ].join('::')
}

function hasLegacyCurrentTenant(legacyRoom: LegacyRoom): boolean {
    const tenant = asRecord(legacyRoom.tenant) as LegacyTenant | null
    return !!tenant && !!asString(tenant.name)
}

function getLegacyCurrentTenant(legacyRoom: LegacyRoom): LegacyTenant | null {
    const tenant = asRecord(legacyRoom.tenant) as LegacyTenant | null
    if (!tenant) return null
    if (!asString(tenant.name)) return null
    return tenant
}

function deriveStatusFromLegacyOnly(legacyRoom: LegacyRoom): RoomStatus {
    const explicit = normalizeLegacyRoomStatus(legacyRoom.status)

    if (explicit === 'Maintenance') return 'Maintenance'

    if (hasLegacyCurrentTenant(legacyRoom)) {
        const currentTenant = getLegacyCurrentTenant(legacyRoom)
        const start = normalizeDate(currentTenant?.rentalStartDate)
        const today = new Date().toISOString().slice(0, 10)

        if (start && start > today) return 'Reserved'
        return 'Occupied'
    }

    return explicit === 'Reserved' ? 'Reserved' : 'Vacant'
}

async function main() {
    const mongoUri = process.env.MONGODB_URI

    if (!mongoUri) {
        throw new Error('MONGODB_URI is not set')
    }

    await mongoose.connect(mongoUri)
    console.log('[reconcile] connected')

    try {
        const legacyBuildings = (await LegacyBuilding.find().lean()) as LegacyBuildingShape[]
        const normalizedRooms = (await Room.find().lean()) as LeanRoom[]
        const normalizedStays = (await Stay.find().lean()) as LeanStay[]
        const tenants = (await Tenant.find().lean()) as LeanTenant[]

        const legacyBuildingById = new Map<string, LegacyBuildingShape>(
            legacyBuildings.map((b) => [String(b._id), b])
        )

        const staysByRoomId = new Map<string, LeanStay[]>()
        for (const stay of normalizedStays) {
            const key = String(stay.roomId)
            const existing = staysByRoomId.get(key) ?? []
            existing.push(stay)
            staysByRoomId.set(key, existing)
        }

        const tenantById = new Map<string, LeanTenant>(
            tenants.map((tenant) => [String(tenant._id), tenant])
        )

        let createdStays = 0
        let updatedStays = 0
        let updatedRooms = 0
        let auditedMismatches = 0

        for (const room of normalizedRooms) {
            const legacyBuilding = legacyBuildingById.get(asString(room.legacyBuildingId))
            if (!legacyBuilding) continue

            const legacyRooms = asRecordArray<LegacyRoom>(legacyBuilding.rooms)
            const legacyRoom =
                legacyRooms.find((r) => {
                    const legacyRoomId = asString(r.id ?? r.name ?? r.roomNo ?? r.roomId)
                    return legacyRoomId === asString(room.legacyRoomId)
                }) ?? null

            if (!legacyRoom) continue

            const roomStays = (staysByRoomId.get(String(room._id)) ?? [])
                .slice()
                .sort((a, b) => compareDateDesc(a.rentalStartDate, b.rentalStartDate))

            const currentStay =
                roomStays.find((stay) => getEffectiveStayStatus(stay) === 'active') ??
                roomStays.find((stay) => getEffectiveStayStatus(stay) === 'reserved') ??
                null

            const legacyCurrentTenant = getLegacyCurrentTenant(legacyRoom)
            const derivedLegacyStatus = deriveStatusFromLegacyOnly(legacyRoom)

            const normalizedCurrentOccupancy = currentStay
                ? getEffectiveStayStatus(currentStay) === 'active' ||
                  getEffectiveStayStatus(currentStay) === 'reserved'
                : false

            const legacyCurrentOccupancy =
                derivedLegacyStatus === 'Occupied' || derivedLegacyStatus === 'Reserved'

            if (normalizedCurrentOccupancy !== legacyCurrentOccupancy) {
                auditedMismatches += 1
                console.log('[reconcile][mismatch]', {
                    roomName: room.name,
                    legacyRoomId: room.legacyRoomId,
                    normalizedCurrentStayStatus: currentStay ? getEffectiveStayStatus(currentStay) : null,
                    legacyStatus: asString(legacyRoom.status),
                    legacyHasCurrentTenant: !!legacyCurrentTenant
                })
            }

            if (legacyCurrentTenant) {
                const legacyTenantKey = buildTenantKeyFromLegacy(legacyCurrentTenant)

                const matchingCurrentStay = roomStays.find((stay) => {
                    const tenant = tenantById.get(String(stay.tenantId))
                    if (!tenant) return false
                    return buildTenantKeyFromTenantDoc(tenant) === legacyTenantKey
                })

                const desiredStatus: StayStatus =
                    normalizeDate(legacyCurrentTenant.rentalStartDate) > new Date().toISOString().slice(0, 10)
                        ? 'reserved'
                        : 'active'

                if (matchingCurrentStay) {
                    const effectiveStatus = getEffectiveStayStatus(matchingCurrentStay)

                    if (
                        effectiveStatus !== desiredStatus ||
                        normalizeDate(matchingCurrentStay.rentalStartDate) !== normalizeDate(legacyCurrentTenant.rentalStartDate) ||
                        normalizeDate(matchingCurrentStay.rentalEndDate) !== normalizeDate(legacyCurrentTenant.rentalEndDate)
                    ) {
                        await Stay.updateOne(
                            { _id: matchingCurrentStay._id },
                            {
                                $set: {
                                    status: desiredStatus,
                                    rentalStartDate: normalizeDate(legacyCurrentTenant.rentalStartDate),
                                    rentalEndDate: normalizeDate(legacyCurrentTenant.rentalEndDate),
                                    checkoutDate: ''
                                }
                            }
                        )

                        updatedStays += 1
                    }
                } else {
                    const tenantDoc = await Tenant.create({
                        fullName: asString(legacyCurrentTenant.name) || 'Unknown',
                        email: asString(legacyCurrentTenant.email),
                        phone: asString(legacyCurrentTenant.phone),
                        country: asString(legacyCurrentTenant.country),
                        gender: '',
                        language: 'english',
                        currency: 'USD',
                        rentalTypeDefault: asString(legacyCurrentTenant.rentalType),
                        dateOfBirth: normalizeDate(legacyCurrentTenant.dateOfBirth),
                        identityNo: asString(legacyCurrentTenant.identityNo),
                        passportExpiryDate: normalizeDate(legacyCurrentTenant.passportExpiryDate),
                        visaExpiryDate: normalizeDate(legacyCurrentTenant.visaExpiryDate),
                        address: asString(legacyCurrentTenant.address),
                        notes: asString(legacyCurrentTenant.notes),
                        isActive: true,
                        legacySource: 'legacy-reconcile'
                    })

                    await Stay.create({
                        buildingId: room.buildingId,
                        roomId: room._id,
                        tenantId: tenantDoc._id,
                        legacyBuildingId: asString(room.legacyBuildingId),
                        legacyRoomId: asString(room.legacyRoomId),
                        legacyTenantRoomNo: asString(room.legacyRoomId),
                        type: asString(legacyCurrentTenant.rentalType) || 'monthly',
                        status: desiredStatus,
                        rentalStartDate: normalizeDate(legacyCurrentTenant.rentalStartDate),
                        rentalEndDate: normalizeDate(legacyCurrentTenant.rentalEndDate),
                        checkoutDate: '',
                        cancelledAt: '',
                        roomRate: asNumber(legacyCurrentTenant.roomRate),
                        depositAmount: asNumber(legacyCurrentTenant.depositAmount),
                        electricityRate: asNumber(legacyCurrentTenant.electricityRate),
                        waterRate: asNumber(legacyCurrentTenant.waterRate),
                        electricityMeterStartAt: asNumber(legacyCurrentTenant.electricityMeterStartAt),
                        waterMeterStartAt: asNumber(legacyCurrentTenant.waterMeterStartAt),
                        notes: asString(legacyCurrentTenant.notes),
                        source: 'legacy-reconcile'
                    })

                    createdStays += 1
                }

                for (const stay of roomStays) {
                    const tenant = tenantById.get(String(stay.tenantId))
                    if (!tenant) continue

                    if (buildTenantKeyFromTenantDoc(tenant) !== legacyTenantKey) {
                        const effectiveStatus = getEffectiveStayStatus(stay)

                        if (effectiveStatus === 'active' || effectiveStatus === 'reserved') {
                            await Stay.updateOne(
                                { _id: stay._id },
                                {
                                    $set: {
                                        status: 'checked_out',
                                        checkoutDate: normalizeDate(legacyCurrentTenant.rentalStartDate) || new Date().toISOString().slice(0, 10)
                                    }
                                }
                            )

                            updatedStays += 1
                        }
                    }
                }
            } else {
                for (const stay of roomStays) {
                    const effectiveStatus = getEffectiveStayStatus(stay)

                    if (effectiveStatus === 'active' || effectiveStatus === 'reserved') {
                        await Stay.updateOne(
                            { _id: stay._id },
                            {
                                $set: {
                                    status: 'checked_out',
                                    checkoutDate: normalizeDate(stay.checkoutDate) || new Date().toISOString().slice(0, 10)
                                }
                            }
                        )

                        updatedStays += 1
                    }
                }
            }

            const finalRoomStatus = deriveStatusFromLegacyOnly(legacyRoom)

            if (normalizeRoomStatus(room.status) !== finalRoomStatus) {
                await Room.updateOne(
                    { _id: room._id },
                    { $set: { status: finalRoomStatus } }
                )
                updatedRooms += 1
            }
        }

        console.log('[reconcile] audited mismatches =', auditedMismatches)
        console.log('[reconcile] created stays =', createdStays)
        console.log('[reconcile] updated stays =', updatedStays)
        console.log('[reconcile] updated rooms =', updatedRooms)
        console.log('[reconcile] completed')
    } finally {
        await mongoose.disconnect()
    }
}

void main().catch((error: unknown) => {
    console.error('[reconcile] error:', error)
    process.exit(1)
})