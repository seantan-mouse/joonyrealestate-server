import { Types } from 'mongoose'
import Counter from '../../models/Counter'
import Room from '../../models/Room'
import Stay from '../../models/Stay'
import Tenant from '../../models/Tenant'
import Invoice from '../../models/Invoice'
import Service from '../../models/Service'
import { toCanonicalIsoDate, toDisplayDate } from '../common/dates'
import {
    asNumber,
    asTrimmedString,
    collectValidationErrors,
    requireDateString
} from '../common/validation'
import { getEffectiveStayStatus } from '../stay/stay.helpers'
import type { CreateInvoiceInput } from './invoice.types'

type LeanRoom = {
    _id: Types.ObjectId
    accountId?: Types.ObjectId
    buildingId: Types.ObjectId
    legacyBuildingId?: string
    legacyRoomId?: string
    name: string
    status?: string
    defaultRoomRate?: number
}

type LeanStay = {
    _id: Types.ObjectId
    tenantId: Types.ObjectId
    type?: string
    status?: string
    rentalStartDate?: string
    rentalEndDate?: string
    checkoutDate?: string
    cancelledAt?: string
    roomRate?: number
    electricityRate?: number
    waterRate?: number
    electricityMeterStartAt?: number
    waterMeterStartAt?: number
}

type LeanTenant = {
    _id: Types.ObjectId
    fullName?: string
    phone?: string
    language?: 'english' | 'khmer' | 'chinese' | 'japanese' | 'korean'
    currency?: 'USD' | 'Riel'
}

type LeanInvoice = {
    _id: Types.ObjectId
    tenantId?: Types.ObjectId | null
    stayId?: Types.ObjectId | null
    date: string
    roomRate?: number
    outstandingAmount?: number
    oldElectricityReading?: number
    electricityReading?: number
    oldWaterReading?: number
    waterReading?: number
    tenantNameSnapshot?: string
}

type LeanService = {
    _id: Types.ObjectId
    name: string
    type?: string
    fee?: number
    date?: string
}

function buildRoomLookup(id: string) {
    const conditions: Array<Record<string, unknown>> = []

    if (Types.ObjectId.isValid(id)) {
        conditions.push({ _id: new Types.ObjectId(id) })
    }

    conditions.push({ legacyRoomId: id })

    return { $or: conditions }
}

function dateToComparable(value: string): string {
    return toCanonicalIsoDate(value)
}

function safeSubtract(left: number, right: number): number {
    return Number((left - right).toFixed(2))
}

function safeMultiply(left: number, right: number): number {
    return Number((left * right).toFixed(2))
}

function safeAdd(values: number[]): number {
    return Number(values.reduce((sum, value) => sum + value, 0).toFixed(2))
}

function getServiceDateIso(value?: string): string {
    if (!value) return ''
    return toCanonicalIsoDate(value)
}

function isMonthlyServiceChargeInCycle(invoiceDateIso: string, serviceDateIso: string): boolean {
    if (!invoiceDateIso || !serviceDateIso) return false

    const invoiceDate = new Date(invoiceDateIso)
    const serviceDate = new Date(serviceDateIso)

    if (Number.isNaN(invoiceDate.getTime()) || Number.isNaN(serviceDate.getTime())) {
        return false
    }

    const cycleStart = new Date(invoiceDate)
    cycleStart.setMonth(invoiceDate.getMonth() - 1)

    const cycleEnd = new Date(invoiceDate)
    cycleEnd.setDate(invoiceDate.getDate() - 1)

    cycleStart.setHours(0, 0, 0, 0)
    cycleEnd.setHours(0, 0, 0, 0)
    serviceDate.setHours(0, 0, 0, 0)

    return serviceDate >= cycleStart && serviceDate <= cycleEnd
}

async function generateInvoiceNumber(): Promise<string> {
    const result = await Counter.findOneAndUpdate(
        { name: 'invoiceNumber' },
        { $inc: { value: 1 } },
        { new: true, upsert: true }
    )

    return String(result?.value ?? '')
}

async function getCurrentStay(room: LeanRoom): Promise<LeanStay | null> {
    const stays = (await Stay.find({ roomId: room._id }).lean()) as LeanStay[]

    const active = stays
        .filter((stay) => getEffectiveStayStatus(stay) === 'active')
        .sort((a, b) => String(b.rentalStartDate ?? '').localeCompare(String(a.rentalStartDate ?? '')))[0]

    if (active) return active

    const reserved = stays
        .filter((stay) => getEffectiveStayStatus(stay) === 'reserved')
        .sort((a, b) => String(b.rentalStartDate ?? '').localeCompare(String(a.rentalStartDate ?? '')))[0]

    if (reserved) return reserved

    const normalizedRoomStatus = String(room.status ?? '').trim().toLowerCase()

    if (normalizedRoomStatus === 'occupied' || normalizedRoomStatus === 'reserved') {
        const latestCheckedOut = stays
            .filter((stay) => getEffectiveStayStatus(stay) === 'checked_out')
            .sort((a, b) => String(b.rentalStartDate ?? '').localeCompare(String(a.rentalStartDate ?? '')))[0]

        if (latestCheckedOut) return latestCheckedOut
    }

    return null
}

function getLatestRelevantInvoice(
    invoices: LeanInvoice[],
    invoiceDateIso: string
): LeanInvoice | null {
    const filtered = invoices
        .filter((invoice) => {
            const candidateIso = dateToComparable(invoice.date)
            return candidateIso !== '' && candidateIso < invoiceDateIso
        })
        .sort((a, b) => dateToComparable(b.date).localeCompare(dateToComparable(a.date)))

    return filtered[0] ?? null
}

function computePreviousBalance(invoices: LeanInvoice[], invoiceDateIso: string): number {
    return safeAdd(
        invoices
            .filter((invoice) => {
                const candidateIso = dateToComparable(invoice.date)
                return candidateIso !== '' && candidateIso < invoiceDateIso
            })
            .map((invoice) => asNumber(invoice.outstandingAmount, 0))
            .filter((amount) => amount > 0)
    )
}

function computeMonthlyServices(
    services: LeanService[],
    invoiceDateIso: string
): { text: string; fee: number } {
    const relevant = services.filter((service) => {
        const serviceType = asTrimmedString(service.type)

        if (serviceType === 'Monthly') {
            return true
        }

        const serviceDateIso = getServiceDateIso(service.date)
        return isMonthlyServiceChargeInCycle(invoiceDateIso, serviceDateIso)
    })

    const text = relevant
        .map((service) => `${service.name} ($${asNumber(service.fee, 0).toFixed(2)})`)
        .join(', ')

    const fee = safeAdd(relevant.map((service) => asNumber(service.fee, 0)))

    return { text, fee }
}

function computeContractNights(stayStartIso: string, stayEndIso: string): number {
    if (!stayStartIso || !stayEndIso) return 0

    const start = new Date(stayStartIso)
    const end = new Date(stayEndIso)

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return 0
    }

    const diffMs = end.getTime() - start.getTime()
    const diffDays = Math.floor(diffMs / 86400000)

    return diffDays > 0 ? diffDays : 0
}

export async function createInvoiceForRoom(roomId: string, input: CreateInvoiceInput) {
    const room = (await Room.findOne(buildRoomLookup(roomId)).lean()) as LeanRoom | null
    if (!room) return { status: 'room_not_found' as const }

    const errors = collectValidationErrors([
        requireDateString(input.date, 'date')
    ])

    if (errors.length > 0) {
        return { status: 'validation_error' as const, errors }
    }

    const invoiceDateIso = toCanonicalIsoDate(asTrimmedString(input.date))
    if (!invoiceDateIso) {
        return { status: 'validation_error' as const, errors: ['date is invalid'] }
    }

    const currentStay = await getCurrentStay(room)
    const tenant = currentStay?.tenantId
        ? ((await Tenant.findById(currentStay.tenantId).lean()) as LeanTenant | null)
        : null

    const invoiceNo = asTrimmedString(input.invoiceNo) || (await generateInvoiceNumber())

    const existingInvoice = await Invoice.findOne({
        roomId: room._id,
        invoiceNo
    })

    if (existingInvoice) {
        return { status: 'duplicate_invoice' as const }
    }

    const tenantScopedInvoices = (await Invoice.find({
        roomId: room._id,
        ...(tenant?._id ? { tenantId: tenant._id } : {})
    }).lean()) as LeanInvoice[]

    const latestRelevantInvoice = getLatestRelevantInvoice(tenantScopedInvoices, invoiceDateIso)
    const previousBalance = computePreviousBalance(tenantScopedInvoices, invoiceDateIso)

    const roomServices = (await Service.find({ roomId: room._id }).lean()) as LeanService[]

    const stayType = asTrimmedString(currentStay?.type || 'monthly').toLowerCase()
    const isContract = stayType === 'contract'

    let roomRate = 0
    let nightlyRate: number | null = null
    let nights: number | null = null
    let stayStart = ''
    let stayEnd = ''
    let electricityRate = 0
    let waterRate = 0
    let oldElectricityReading = 0
    let electricityReading = 0
    let electricityPrice = 0
    let oldWaterReading = 0
    let waterReading = 0
    let waterPrice = 0
    let services = ''
    let servicesFee = 0

    const others = asTrimmedString(input.others)
    const othersFee = asNumber(input.othersFee, 0)

    if (isContract) {
        stayStart = toCanonicalIsoDate(asTrimmedString(input.stayStart) || asTrimmedString(currentStay?.rentalStartDate))
        stayEnd = toCanonicalIsoDate(
            asTrimmedString(input.stayEnd) ||
            asTrimmedString(currentStay?.checkoutDate) ||
            asTrimmedString(currentStay?.rentalEndDate)
        )

        const effectiveNightlyRate =
            asNumber(input.nightlyRate, 0) ||
            asNumber(input.roomRate, 0) ||
            asNumber(currentStay?.roomRate, 0)

        const effectiveNights =
            asNumber(input.nights, 0) ||
            computeContractNights(stayStart, stayEnd)

        nightlyRate = effectiveNightlyRate
        nights = effectiveNights
        roomRate = safeMultiply(effectiveNightlyRate, effectiveNights)
    } else {
        roomRate =
            asNumber(input.roomRate, 0) ||
            asNumber(currentStay?.roomRate, 0) ||
            asNumber(room.defaultRoomRate, 0)

        electricityRate = asNumber(currentStay?.electricityRate, 0)
        waterRate = asNumber(currentStay?.waterRate, 0)

        oldElectricityReading =
            latestRelevantInvoice?.electricityReading ??
            asNumber(currentStay?.electricityMeterStartAt, 0)

        oldWaterReading =
            latestRelevantInvoice?.waterReading ??
            asNumber(currentStay?.waterMeterStartAt, 0)

        electricityReading = asNumber(input.electricityReading, oldElectricityReading)
        waterReading = asNumber(input.waterReading, oldWaterReading)

        electricityPrice = safeMultiply(
            Math.max(0, safeSubtract(electricityReading, oldElectricityReading)),
            electricityRate
        )

        waterPrice = safeMultiply(
            Math.max(0, safeSubtract(waterReading, oldWaterReading)),
            waterRate
        )

        const monthlyServices = computeMonthlyServices(roomServices, invoiceDateIso)
        services = monthlyServices.text
        servicesFee = monthlyServices.fee
    }

    const totalAmount = safeAdd([
        roomRate,
        electricityPrice,
        waterPrice,
        servicesFee,
        othersFee
    ])

    const invoice = await Invoice.create({
        accountId: room.accountId ?? undefined,
        buildingId: room.buildingId,
        roomId: room._id,
        stayId: currentStay?._id ?? null,
        tenantId: tenant?._id ?? null,
        legacyBuildingId: room.legacyBuildingId ?? '',
        legacyRoomId: room.legacyRoomId ?? room.name,
        invoiceNo,
        date: toDisplayDate(invoiceDateIso),
        billingPeriodStart: asTrimmedString(input.billingPeriodStart),
        billingPeriodEnd: asTrimmedString(input.billingPeriodEnd),
        roomRate,
        nightlyRate,
        nights,
        stayStart,
        stayEnd,
        electricityRate,
        waterRate,
        oldElectricityReading,
        electricityReading,
        electricityPrice,
        oldWaterReading,
        waterReading,
        waterPrice,
        services,
        servicesFee,
        others,
        othersFee,
        previousBalance,
        totalAmount,
        totalAmountRiel: asNumber(input.totalAmountRiel, 0),
        status: 'Not paid',
        outstandingAmount: totalAmount,
        tenantNameSnapshot: tenant?.fullName ?? '',
        tenantPhoneSnapshot: tenant?.phone ?? '',
        tenantLanguageSnapshot: tenant?.language ?? 'english',
        tenantCurrencySnapshot: tenant?.currency ?? 'USD',
        tenantCheckInDateSnapshot: currentStay?.rentalStartDate ?? ''
    })

    return { status: 'created' as const, invoice }
}
