import { Types } from 'mongoose'
import Building from '../../models/Building'
import Room from '../../models/Room'
import Stay from '../../models/Stay'
import Tenant from '../../models/Tenant'
import {
    normalizeCurrency,
    normalizeGender,
    normalizeLanguage,
    normalizeStayType,
    normalizeRoomStatus,
    toNumber,
    toStringValue
} from '../room/room.helpers'
import { getTodayIsoDate } from '../common/dates'
import { getEffectiveStayStatus } from './stay.helpers'

type CreateStayInput = {
    tenant?: {
        fullName?: string
        email?: string
        phone?: string
        country?: string
        gender?: string
        language?: string
        currency?: string
        dateOfBirth?: string
        identityNo?: string
        passportExpiryDate?: string
        visaExpiryDate?: string
        address?: string
        notes?: string
    }
    stay?: {
        type?: string
        rentalStartDate?: string
        rentalEndDate?: string
        roomRate?: number
        depositAmount?: number
        electricityRate?: number
        waterRate?: number
        electricityMeterStartAt?: number
        waterMeterStartAt?: number
        notes?: string
    }
}

type CheckoutStayInput = {
    checkoutDate?: string
}

type UpdateStayInput = CreateStayInput & {
    checkoutDate?: string
}

type RoomLookup = {
    $or: Array<Record<string, unknown>>
}

type ExistingStayLean = {
    _id: Types.ObjectId
    status?: string
    rentalStartDate?: string
    rentalEndDate?: string
    checkoutDate?: string
    cancelledAt?: string
}

function buildRoomLookup(id: string): RoomLookup {
    const conditions: Array<Record<string, unknown>> = []

    if (Types.ObjectId.isValid(id)) {
        conditions.push({ _id: new Types.ObjectId(id) })
    }

    conditions.push({ legacyRoomId: id })

    return { $or: conditions }
}

function getTodayDate(): string {
    return getTodayIsoDate()
}

function getNewStayStatus(rentalStartDate: string): 'reserved' | 'active' {
    const today = getTodayDate()
    return rentalStartDate > today ? 'reserved' : 'active'
}

function getUpdatedStayStatus(
    rentalStartDate: string,
    checkoutDate: string
): 'reserved' | 'active' | 'checked_out' {
    const today = getTodayDate()

    if (checkoutDate && checkoutDate <= today) {
        return 'checked_out'
    }

    return rentalStartDate > today ? 'reserved' : 'active'
}

function getRoomStatusForStayStatus(
    stayStatus: 'reserved' | 'active' | 'checked_out'
): 'Vacant' | 'Occupied' | 'Reserved' | 'Maintenance' {
    if (stayStatus === 'checked_out') return normalizeRoomStatus('Vacant')
    if (stayStatus === 'reserved') return normalizeRoomStatus('Reserved')
    return normalizeRoomStatus('Occupied')
}

function getRoomStatusFromStays(stays: ExistingStayLean[]): 'Vacant' | 'Occupied' | 'Reserved' | 'Maintenance' {
    if (stays.some((stay) => getEffectiveStayStatus(stay) === 'active')) {
        return normalizeRoomStatus('Occupied')
    }

    if (stays.some((stay) => getEffectiveStayStatus(stay) === 'reserved')) {
        return normalizeRoomStatus('Reserved')
    }

    return normalizeRoomStatus('Vacant')
}

export async function createStayForRoom(roomId: string, input: CreateStayInput, ownerAccountId?: string) {
    const room = await Room.findOne(buildRoomLookup(roomId))
    if (!room) return { status: 'room_not_found' as const }

    const building = await Building.findById(room.buildingId)
    if (!building) return { status: 'building_not_found' as const }

    const fullName = toStringValue(input.tenant?.fullName)
    if (!fullName) return { status: 'invalid_tenant_name' as const }

    const rentalStartDate = toStringValue(input.stay?.rentalStartDate)
    if (!rentalStartDate) return { status: 'invalid_rental_start_date' as const }

    const tenant = await Tenant.create({
        accountId: building.accountId ?? undefined,
        fullName,
        email: toStringValue(input.tenant?.email),
        phone: toStringValue(input.tenant?.phone),
        country: toStringValue(input.tenant?.country),
        gender: normalizeGender(toStringValue(input.tenant?.gender)),
        language: normalizeLanguage(toStringValue(input.tenant?.language)),
        currency: normalizeCurrency(toStringValue(input.tenant?.currency)),
        rentalTypeDefault: normalizeStayType(toStringValue(input.stay?.type)),
        dateOfBirth: toStringValue(input.tenant?.dateOfBirth),
        identityNo: toStringValue(input.tenant?.identityNo),
        passportExpiryDate: toStringValue(input.tenant?.passportExpiryDate),
        visaExpiryDate: toStringValue(input.tenant?.visaExpiryDate),
        address: toStringValue(input.tenant?.address),
        notes: toStringValue(input.tenant?.notes),
        isActive: true,
        legacySource: 'manual'
    })

    const existingStays = (await Stay.find({ roomId: room._id })
        .sort({ rentalStartDate: -1 })
        .lean()) as ExistingStayLean[]

    const newStayStatus = getNewStayStatus(rentalStartDate)
    const existingCurrentStay = existingStays.find(
        (stay) => getEffectiveStayStatus(stay) === 'active'
    )

    if (newStayStatus === 'active' && existingCurrentStay) {
        await Stay.findByIdAndUpdate(existingCurrentStay._id, {
            $set: {
                status: 'checked_out',
                checkoutDate: rentalStartDate
            }
        })
    }

    const stay = await Stay.create({
        accountId: building.accountId ?? undefined,
        ownerAccountId: ownerAccountId && Types.ObjectId.isValid(ownerAccountId)
            ? new Types.ObjectId(ownerAccountId)
            : building.accountId ?? undefined,
        buildingId: building._id,
        roomId: room._id,
        tenantId: tenant._id,
        legacyBuildingId: building.legacyBuildingId ?? '',
        legacyRoomId: room.legacyRoomId ?? room.name,
        legacyTenantRoomNo: room.legacyRoomId ?? room.name,
        type: normalizeStayType(toStringValue(input.stay?.type)),
        status: newStayStatus,
        rentalStartDate,
        rentalEndDate: toStringValue(input.stay?.rentalEndDate),
        checkoutDate: '',
        cancelledAt: '',
        roomRate: toNumber(input.stay?.roomRate, room.defaultRoomRate ?? 0),
        depositAmount: toNumber(input.stay?.depositAmount, 0),
        electricityRate: toNumber(input.stay?.electricityRate, 0),
        waterRate: toNumber(input.stay?.waterRate, 0),
        electricityMeterStartAt: toNumber(input.stay?.electricityMeterStartAt, 0),
        waterMeterStartAt: toNumber(input.stay?.waterMeterStartAt, 0),
        notes: toStringValue(input.stay?.notes),
        source: 'manual'
    })

    room.status = normalizeRoomStatus(newStayStatus === 'active' || existingCurrentStay ? 'Occupied' : 'Reserved')

    if (!room.defaultRoomRate || room.defaultRoomRate === 0) {
        room.defaultRoomRate = toNumber(input.stay?.roomRate, room.defaultRoomRate ?? 0)
    }

    await room.save()

    return { status: 'created' as const, tenant, stay, room }
}

export async function checkoutStayForRoom(roomId: string, input: CheckoutStayInput) {
    const room = await Room.findOne(buildRoomLookup(roomId))
    if (!room) return { status: 'room_not_found' as const }

    const existingStays = (await Stay.find({ roomId: room._id })
        .sort({ rentalStartDate: -1 })
        .lean()) as ExistingStayLean[]

    const currentStay = existingStays.find(
        (stay) => getEffectiveStayStatus(stay) === 'active'
    )

    const fallbackStay = existingStays.find((stay) => getEffectiveStayStatus(stay) !== 'cancelled')
    const roomLooksOccupied = ['occupied', 'reserved'].includes(String(room.status ?? '').trim().toLowerCase())

    if (!currentStay && !roomLooksOccupied) {
        return { status: 'active_stay_not_found' as const }
    }

    const checkoutDate = toStringValue(input.checkoutDate) || getTodayDate()

    const stay = currentStay || fallbackStay
        ? await Stay.findByIdAndUpdate(
            (currentStay || fallbackStay)!._id,
            {
                $set: {
                    status: 'checked_out',
                    checkoutDate
                }
            },
            { new: true }
        )
        : null

    const updatedStays = (await Stay.find({ roomId: room._id }).lean()) as ExistingStayLean[]
    room.status = getRoomStatusFromStays(updatedStays)
    await room.save()

    return {
        status: 'checked_out' as const,
        stay,
        room
    }
}

export async function updateStayForRoom(roomId: string, stayId: string, input: UpdateStayInput) {
    const room = await Room.findOne(buildRoomLookup(roomId))
    if (!room) return { status: 'room_not_found' as const }

    const stay = await Stay.findOne({ _id: stayId, roomId: room._id })
    if (!stay) return { status: 'stay_not_found' as const }

    const tenant = await Tenant.findById(stay.tenantId)
    if (!tenant) return { status: 'tenant_not_found' as const }

    const fullName = toStringValue(input.tenant?.fullName)
    if (!fullName) return { status: 'invalid_tenant_name' as const }

    const rentalStartDate = toStringValue(input.stay?.rentalStartDate)
    if (!rentalStartDate) return { status: 'invalid_rental_start_date' as const }

    tenant.fullName = fullName
    tenant.email = toStringValue(input.tenant?.email)
    tenant.phone = toStringValue(input.tenant?.phone)
    tenant.country = toStringValue(input.tenant?.country)
    tenant.gender = normalizeGender(toStringValue(input.tenant?.gender))
    tenant.language = normalizeLanguage(toStringValue(input.tenant?.language))
    tenant.currency = normalizeCurrency(toStringValue(input.tenant?.currency))
    tenant.rentalTypeDefault = normalizeStayType(toStringValue(input.stay?.type))
    tenant.dateOfBirth = toStringValue(input.tenant?.dateOfBirth)
    tenant.identityNo = toStringValue(input.tenant?.identityNo)
    tenant.passportExpiryDate = toStringValue(input.tenant?.passportExpiryDate)
    tenant.visaExpiryDate = toStringValue(input.tenant?.visaExpiryDate)
    tenant.address = toStringValue(input.tenant?.address)
    tenant.notes = toStringValue(input.tenant?.notes)

    const checkoutDate = input.checkoutDate !== undefined
        ? toStringValue(input.checkoutDate)
        : toStringValue(stay.checkoutDate)

    stay.type = normalizeStayType(toStringValue(input.stay?.type))
    stay.status = getUpdatedStayStatus(rentalStartDate, checkoutDate)
    stay.rentalStartDate = rentalStartDate
    stay.rentalEndDate = toStringValue(input.stay?.rentalEndDate)
    stay.checkoutDate = checkoutDate
    stay.roomRate = toNumber(input.stay?.roomRate, room.defaultRoomRate ?? 0)
    stay.depositAmount = toNumber(input.stay?.depositAmount, 0)
    stay.electricityRate = toNumber(input.stay?.electricityRate, 0)
    stay.waterRate = toNumber(input.stay?.waterRate, 0)
    stay.electricityMeterStartAt = toNumber(input.stay?.electricityMeterStartAt, 0)
    stay.waterMeterStartAt = toNumber(input.stay?.waterMeterStartAt, 0)
    stay.notes = toStringValue(input.stay?.notes)

    await Promise.all([
        tenant.save(),
        stay.save()
    ])

    const updatedStays = (await Stay.find({ roomId: room._id }).lean()) as ExistingStayLean[]
    room.status = getRoomStatusFromStays(updatedStays)

    if (room.status === 'Vacant') {
        room.status = getRoomStatusForStayStatus(stay.status)
    }

    if (!room.defaultRoomRate || room.defaultRoomRate === 0) {
        room.defaultRoomRate = toNumber(input.stay?.roomRate, room.defaultRoomRate ?? 0)
    }

    await room.save()

    return {
        status: 'updated' as const,
        tenant,
        stay,
        room
    }
}
