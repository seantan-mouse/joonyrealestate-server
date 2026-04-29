import { Types } from 'mongoose'
import Account from '../../models/Account'
import Building from '../../models/Building'
import Counter from '../../models/Counter'
import Invoice from '../../models/Invoice'
import Payment from '../../models/Payment'
import Room from '../../models/Room'
import Stay from '../../models/Stay'
import Tenant from '../../models/Tenant'
import { toCanonicalIsoDate, toDisplayDate } from '../common/dates'
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
        businessSource?: string
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
    bookingPayment?: {
        status?: 'unpaid' | 'paid' | 'partial'
        amount?: number
        paymentDate?: string
        method?: 'cash' | 'bank' | 'khqr' | 'card' | 'other'
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
    rentalStartDate: string
): 'reserved' | 'active' {
    const today = getTodayDate()
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

async function generateInvoiceNumber(): Promise<string> {
    const result = await Counter.findOneAndUpdate(
        { name: 'invoiceNumber' },
        { $inc: { value: 1 } },
        { new: true, upsert: true }
    )

    return String(result?.value ?? '')
}

function computeBookingNights(startDate: string, endDate: string): number {
    const start = new Date(startDate)
    const end = new Date(endDate || startDate)

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return 1
    }

    const diffDays = Math.floor((end.getTime() - start.getTime()) / 86400000)
    return Math.max(1, diffDays)
}

function computeBookingInvoiceTotal(params: {
    stayType: string
    roomRate: number
    startDate: string
    endDate: string
}): {
    totalAmount: number
    nightlyRate: number | null
    nights: number | null
    stayStart: string
    stayEnd: string
} {
    const stayType = String(params.stayType ?? '').trim().toLowerCase()
    const roomRate = toNumber(params.roomRate, 0)

    if (stayType === 'monthly') {
        return {
            totalAmount: Number(roomRate.toFixed(2)),
            nightlyRate: null,
            nights: null,
            stayStart: '',
            stayEnd: ''
        }
    }

    const stayStart = toCanonicalIsoDate(params.startDate)
    const stayEnd = toCanonicalIsoDate(params.endDate || params.startDate)
    const nights = computeBookingNights(stayStart, stayEnd)

    return {
        totalAmount: Number((roomRate * nights).toFixed(2)),
        nightlyRate: roomRate,
        nights,
        stayStart,
        stayEnd
    }
}

function normalizePaymentMethod(value?: string): 'cash' | 'bank' | 'khqr' | 'card' | 'other' {
    if (
        value === 'bank' ||
        value === 'khqr' ||
        value === 'card' ||
        value === 'other'
    ) {
        return value
    }

    return 'cash'
}

async function maybeCreateBookingInvoice(params: {
    input: CreateStayInput
    buildingAccountId?: Types.ObjectId
    ownerAccountId?: string
    buildingId: Types.ObjectId
    room: {
        _id: Types.ObjectId
        name: string
        legacyBuildingId?: string
        legacyRoomId?: string
    }
    tenant: {
        _id: Types.ObjectId
        fullName: string
        phone?: string
        language?: string
        currency?: string
    }
    stay: {
        _id: Types.ObjectId
        type?: string
        rentalStartDate?: string
        rentalEndDate?: string
        roomRate?: number
    }
}) {
    const bookingPayment = params.input.bookingPayment
    if (!bookingPayment) return null

    const accountId = params.ownerAccountId && Types.ObjectId.isValid(params.ownerAccountId)
        ? new Types.ObjectId(params.ownerAccountId)
        : params.buildingAccountId

    const account = accountId
        ? await Account.findById(accountId).select('slug').lean()
        : null

    if (String(account?.slug ?? '').trim().toLowerCase() === 'dneth') {
        return null
    }

    const paymentStatus = bookingPayment.status === 'paid' || bookingPayment.status === 'partial'
        ? bookingPayment.status
        : 'unpaid'

    const invoiceNo = await generateInvoiceNumber()
    const invoiceDateIso = toCanonicalIsoDate(params.stay.rentalStartDate ?? '') || getTodayDate()
    const stayType = normalizeStayType(params.stay.type)
    const totals = computeBookingInvoiceTotal({
        stayType,
        roomRate: toNumber(params.stay.roomRate, 0),
        startDate: params.stay.rentalStartDate ?? '',
        endDate: params.stay.rentalEndDate ?? ''
    })

    const paidAmount = paymentStatus === 'unpaid'
        ? 0
        : Math.min(
            totals.totalAmount,
            Math.max(0, toNumber(bookingPayment.amount, totals.totalAmount))
        )
    const outstandingAmount = Math.max(0, Number((totals.totalAmount - paidAmount).toFixed(2)))

    const invoice = await Invoice.create({
        accountId: params.buildingAccountId ?? undefined,
        buildingId: params.buildingId,
        roomId: params.room._id,
        stayId: params.stay._id,
        tenantId: params.tenant._id,
        legacyBuildingId: params.room.legacyBuildingId ?? '',
        legacyRoomId: params.room.legacyRoomId ?? params.room.name,
        invoiceNo,
        date: toDisplayDate(invoiceDateIso),
        billingPeriodStart: totals.stayStart,
        billingPeriodEnd: totals.stayEnd,
        roomRate: totals.totalAmount,
        nightlyRate: totals.nightlyRate,
        nights: totals.nights,
        stayStart: totals.stayStart,
        stayEnd: totals.stayEnd,
        electricityRate: 0,
        waterRate: 0,
        oldElectricityReading: 0,
        electricityReading: 0,
        electricityPrice: 0,
        oldWaterReading: 0,
        waterReading: 0,
        waterPrice: 0,
        services: '',
        servicesFee: 0,
        others: '',
        othersFee: 0,
        previousBalance: 0,
        totalAmount: totals.totalAmount,
        totalAmountRiel: 0,
        status: outstandingAmount <= 0 ? 'Paid' : paidAmount > 0 ? 'Partially paid' : 'Not paid',
        outstandingAmount,
        tenantNameSnapshot: params.tenant.fullName ?? '',
        tenantPhoneSnapshot: params.tenant.phone ?? '',
        tenantLanguageSnapshot: params.tenant.language ?? 'english',
        tenantCurrencySnapshot: params.tenant.currency ?? 'USD',
        tenantCheckInDateSnapshot: params.stay.rentalStartDate ?? ''
    })

    const payment = paidAmount > 0
        ? await Payment.create({
            accountId: params.buildingAccountId ?? undefined,
            invoiceId: invoice._id,
            buildingId: params.buildingId,
            roomId: params.room._id,
            stayId: params.stay._id,
            tenantId: params.tenant._id,
            paymentDate: toCanonicalIsoDate(bookingPayment.paymentDate ?? '') || getTodayDate(),
            amount: paidAmount,
            type: outstandingAmount <= 0 ? 'full' : 'partial',
            method: normalizePaymentMethod(bookingPayment.method),
            notes: '',
            source: 'booking'
        })
        : null

    return {
        invoice,
        payment
    }
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
        businessSource: toStringValue(input.tenant?.businessSource),
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

    const bookingInvoice = await maybeCreateBookingInvoice({
        input,
        buildingAccountId: building.accountId,
        ownerAccountId,
        buildingId: building._id,
        room,
        tenant,
        stay
    })

    return { status: 'created' as const, tenant, stay, room, bookingInvoice }
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
    tenant.businessSource = toStringValue(input.tenant?.businessSource)
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
    stay.status = getUpdatedStayStatus(rentalStartDate)
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
