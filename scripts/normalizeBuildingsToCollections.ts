import 'dotenv/config'
import mongoose, { Types } from 'mongoose'

import LegacyBuilding from '../models/LegacyBuilding'
import Building from '../models/Building'
import Room, { type RoomStatus } from '../models/Room'
import Tenant from '../models/Tenant'
import Stay, { type StayStatus } from '../models/Stay'
import MeterReading from '../models/MeterReading'
import Invoice, { type InvoiceStatus } from '../models/Invoice'
import Payment from '../models/Payment'
import Expense from '../models/Expense'
import Service from '../models/Service'
import Document from '../models/Document'

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

type LegacyInvoicePayment = LegacyRecord & {
    type?: unknown
    amount?: unknown
    notes?: unknown
}

type LegacyInvoice = LegacyRecord & {
    invoiceNo?: unknown
    date?: unknown
    roomRate?: unknown
    nightlyRate?: unknown
    nights?: unknown
    stayStart?: unknown
    stayEnd?: unknown
    electricityRate?: unknown
    waterRate?: unknown
    oldElectricityReading?: unknown
    electricityReading?: unknown
    electricityPrice?: unknown
    oldWaterReading?: unknown
    waterReading?: unknown
    waterPrice?: unknown
    services?: unknown
    servicesFee?: unknown
    others?: unknown
    othersFee?: unknown
    previousBalance?: unknown
    totalAmount?: unknown
    totalAmountRiel?: unknown
    status?: unknown
    outstandingAmount?: unknown
    tenantName?: unknown
    tenantPhone?: unknown
    tenantLanguage?: unknown
    tenantCurrency?: unknown
    tenantCheckInDate?: unknown
    payment?: unknown
}

type LegacyReading = LegacyRecord & {
    date?: unknown
    electricity?: unknown
    water?: unknown
}

type LegacyService = LegacyRecord & {
    name?: unknown
    type?: unknown
    fee?: unknown
    date?: unknown
}

type LegacyFile = LegacyRecord & {
    date?: unknown
    tenantName?: unknown
    fileName?: unknown
    link?: unknown
}

type LegacyExpense = LegacyRecord & {
    name?: unknown
    type?: unknown
    date?: unknown
    amount?: unknown
    applyToRoomsType?: unknown
    notes?: unknown
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
    invoices?: unknown
    readings?: unknown
    services?: unknown
    contracts?: unknown
    visaPhotos?: unknown
    passportPhotos?: unknown
    otherFiles?: unknown
}

type LegacyBuildingShape = {
    _id: Types.ObjectId
    name?: unknown
    rooms?: unknown
    expenses?: unknown
    services?: unknown
    settings?: unknown
    notes?: unknown
}

type EnrichedStay = {
    _id: Types.ObjectId
    tenantId: Types.ObjectId
    tenantNameSnapshot: string
    rentalStartDate: string
    rentalEndDate: string
    checkoutDate: string
    status: StayStatus
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

function normalizeLanguage(
    value: unknown
): 'english' | 'khmer' | 'chinese' | 'japanese' | 'korean' {
    const language = asString(value).toLowerCase()

    if (language === 'english') return 'english'
    if (language === 'khmer') return 'khmer'
    if (language === 'chinese') return 'chinese'
    if (language === 'japanese') return 'japanese'
    if (language === 'korean') return 'korean'

    return 'english'
}

function normalizeCurrency(value: unknown): 'USD' | 'Riel' {
    return asString(value) === 'Riel' ? 'Riel' : 'USD'
}

function normalizeGender(value: unknown): 'male' | 'female' | 'other' | '' {
    const gender = asString(value).toLowerCase()

    if (gender === 'male') return 'male'
    if (gender === 'female') return 'female'
    if (gender === 'other') return 'other'

    return ''
}

function normalizeInvoiceStatus(value: unknown): InvoiceStatus {
    const status = asString(value)

    if (status === 'Paid') return 'Paid'
    if (status === 'Partially paid') return 'Partially paid'
    if (status === 'Voided') return 'Voided'

    return 'Not paid'
}

function deriveStayStatus(stay: LegacyTenant): StayStatus {
    const today = new Date().toISOString().slice(0, 10)

    const checkoutDate = normalizeDate(stay.checkoutDate)
    const rentalStartDate = normalizeDate(stay.rentalStartDate)
    const rentalEndDate = normalizeDate(stay.rentalEndDate)

    if (checkoutDate) return 'checked_out'
    if (rentalStartDate && rentalStartDate > today) return 'reserved'
    if (rentalEndDate && rentalEndDate < today) return 'checked_out'

    return 'active'
}

function deriveRoomStatus(params: {
    legacyRoomStatus: unknown
    stayDocs: EnrichedStay[]
}): RoomStatus {
    const explicit = asString(params.legacyRoomStatus)

    if (explicit === 'Maintenance') return 'Maintenance'

    const hasActiveStay = params.stayDocs.some((stay) => stay.status === 'active')
    if (hasActiveStay) return 'Occupied'

    const hasReservedStay = params.stayDocs.some((stay) => stay.status === 'reserved')
    if (hasReservedStay) return 'Reserved'

    return 'Vacant'
}

function buildTenantKey(tenant: LegacyTenant): string {
    return [
        asString(tenant.name).toLowerCase(),
        asString(tenant.phone),
        normalizeDate(tenant.dateOfBirth)
    ].join('::')
}

function makeInvoiceUniqueKey(
    roomId: string,
    invoiceNo: unknown,
    date: unknown,
    index: number
): string {
    return [roomId, asString(invoiceNo), normalizeDate(date), String(index)].join('::')
}

function chooseStayForInvoice(stays: EnrichedStay[], invoice: LegacyInvoice): EnrichedStay | null {
    const invoiceDate = normalizeDate(invoice.date)

    if (!invoiceDate || stays.length === 0) return null

    const exactWindowMatch = stays.find((stay) => {
        const start = normalizeDate(stay.rentalStartDate)
        const end = normalizeDate(stay.rentalEndDate)

        if (!start) return false
        if (start > invoiceDate) return false
        if (end && invoiceDate > end) return false

        return true
    })

    if (exactWindowMatch) return exactWindowMatch

    const sameTenantFallback = stays.find((stay) => {
        return asString(stay.tenantNameSnapshot) === asString(invoice.tenantName)
    })

    if (sameTenantFallback) return sameTenantFallback

    return stays[stays.length - 1] || null
}

function chooseStayForReading(stays: EnrichedStay[], readingDate: string): EnrichedStay | null {
    const date = normalizeDate(readingDate)

    if (!date || stays.length === 0) return null

    const exactWindowMatch = stays.find((stay) => {
        const start = normalizeDate(stay.rentalStartDate)
        const end = normalizeDate(stay.rentalEndDate)

        if (!start) return false
        if (start > date) return false
        if (end && date > end) return false

        return true
    })

    if (exactWindowMatch) return exactWindowMatch

    return stays[stays.length - 1] || null
}

async function resetNormalizedCollections(): Promise<void> {
    if (process.env.NORMALIZE_NUKE_OK !== 'YES') {
        throw new Error('Refusing to reset normalized collections. Set NORMALIZE_NUKE_OK=YES')
    }

    await Promise.all([
        Building.deleteMany({}),
        Room.deleteMany({}),
        Tenant.deleteMany({}),
        Stay.deleteMany({}),
        MeterReading.deleteMany({}),
        Invoice.deleteMany({}),
        Payment.deleteMany({}),
        Expense.deleteMany({}),
        Service.deleteMany({}),
        Document.deleteMany({})
    ])

    console.log('[normalize] cleared normalized collections')
}

async function migrate(): Promise<void> {
    const mongoUri = process.env.MONGODB_URI

    if (!mongoUri) {
        throw new Error('MONGODB_URI is not set')
    }

    await mongoose.connect(mongoUri)
    console.log('[normalize] connected')

    try {
        await resetNormalizedCollections()

        const legacyBuildings = (await LegacyBuilding.find().lean()) as LegacyBuildingShape[]
        console.log(`[normalize] found ${legacyBuildings.length} legacy buildings`)

        const tenantCache = new Map<string, Types.ObjectId>()

        for (const legacyBuilding of legacyBuildings) {
            const buildingName = asString(legacyBuilding.name)
            const buildingIdString = asString(legacyBuilding._id)
            const settings = asRecord(legacyBuilding.settings)

            const building = await Building.findOneAndUpdate(
                { legacyBuildingId: buildingIdString },
                {
                    $set: {
                        name: buildingName,
                        code: '',
                        notes: asString(legacyBuilding.notes),
                        settings: {
                            roomsPerRow: asNumber(settings?.roomsPerRow) || 8,
                            interestRate: asNumber(settings?.interestRate)
                        },
                        isActive: true,
                        legacyBuildingId: buildingIdString
                    }
                },
                {
                    new: true,
                    upsert: true
                }
            )

            if (!building?._id) {
                throw new Error(
                    `[normalize] normalized building missing _id for legacy building ${buildingName}`
                )
            }

            const legacyRooms = asRecordArray<LegacyRoom>(legacyBuilding.rooms)

            console.log(`[normalize] building ${buildingName} -> ${legacyRooms.length} rooms`)

            for (const legacyRoom of legacyRooms) {
                const roomName = asString(
                    legacyRoom.name ?? legacyRoom.id ?? legacyRoom.roomNo ?? legacyRoom.roomId
                )

                const legacyRoomId = asString(
                    legacyRoom.id ?? legacyRoom.name ?? legacyRoom.roomNo ?? legacyRoom.roomId
                )

                if (!roomName) {
                    console.warn('[normalize] skipping room with empty name', {
                        buildingName,
                        buildingId: String(building._id),
                        legacyBuildingId: buildingIdString,
                        legacyRoom
                    })
                    continue
                }

                                const currentTenantRecord = asRecord(legacyRoom.tenant) as LegacyTenant | null
                const legacyTenants = asRecordArray<LegacyTenant>(legacyRoom.tenants)

                type PendingStayInput = {
                    tenantId: Types.ObjectId
                    legacyBuildingId: string
                    legacyRoomId: string
                    legacyTenantRoomNo: string
                    type: 'monthly' | 'daily' | 'contract'
                    status: StayStatus
                    rentalStartDate: string
                    rentalEndDate: string
                    checkoutDate: string
                    roomRate: number
                    depositAmount: number
                    electricityRate: number
                    waterRate: number
                    electricityMeterStartAt: number
                    waterMeterStartAt: number
                    notes: string
                    source: string
                    tenantNameSnapshot: string
                }

                const pendingStays: PendingStayInput[] = []
                const pendingStayByTenantKey = new Map<string, PendingStayInput>()

                for (const legacyTenant of legacyTenants) {
                    const tenantKey = buildTenantKey(legacyTenant)

                    let tenantId = tenantCache.get(tenantKey)

                    if (!tenantId) {
                        const tenantDoc = await Tenant.create({
                            fullName: asString(legacyTenant.name) || 'Unknown',
                            email: asString(legacyTenant.email),
                            phone: asString(legacyTenant.phone),
                            country: asString(legacyTenant.country),
                            gender: normalizeGender(legacyTenant.gender),
                            language: normalizeLanguage(legacyTenant.language),
                            currency: normalizeCurrency(legacyTenant.currency),
                            rentalTypeDefault: asString(legacyTenant.rentalType),
                            dateOfBirth: normalizeDate(legacyTenant.dateOfBirth),
                            identityNo: asString(legacyTenant.identityNo),
                            passportExpiryDate: normalizeDate(legacyTenant.passportExpiryDate),
                            visaExpiryDate: normalizeDate(legacyTenant.visaExpiryDate),
                            address: asString(legacyTenant.address),
                            notes: asString(legacyTenant.notes),
                            isActive: true,
                            legacySource: 'nested-building-migration'
                        })

                        tenantId = tenantDoc._id as Types.ObjectId
                        tenantCache.set(tenantKey, tenantId)
                    }

                    const pendingStay: PendingStayInput = {
                        tenantId,
                        legacyBuildingId: buildingIdString,
                        legacyRoomId,
                        legacyTenantRoomNo: asString(legacyTenant.roomNo),
                        type: (asString(legacyTenant.rentalType) || 'monthly') as 'monthly' | 'daily' | 'contract',
                        status: deriveStayStatus(legacyTenant),
                        rentalStartDate: normalizeDate(legacyTenant.rentalStartDate),
                        rentalEndDate: normalizeDate(legacyTenant.rentalEndDate),
                        checkoutDate: normalizeDate(legacyTenant.checkoutDate),
                        roomRate: asNumber(legacyTenant.roomRate),
                        depositAmount: asNumber(legacyTenant.depositAmount),
                        electricityRate: asNumber(legacyTenant.electricityRate),
                        waterRate: asNumber(legacyTenant.waterRate),
                        electricityMeterStartAt: asNumber(legacyTenant.electricityMeterStartAt),
                        waterMeterStartAt: asNumber(legacyTenant.waterMeterStartAt),
                        notes: asString(legacyTenant.notes),
                        source: 'migration',
                        tenantNameSnapshot: asString(legacyTenant.name)
                    }

                    pendingStays.push(pendingStay)
                    pendingStayByTenantKey.set(tenantKey, pendingStay)
                }

                if (currentTenantRecord) {
                    const currentTenantKey = buildTenantKey(currentTenantRecord)
                    const existingCurrentStay = pendingStayByTenantKey.get(currentTenantKey)

                    if (!existingCurrentStay) {
                        let tenantId = tenantCache.get(currentTenantKey)

                        if (!tenantId) {
                            const tenantDoc = await Tenant.create({
                                fullName: asString(currentTenantRecord.name) || 'Unknown',
                                email: asString(currentTenantRecord.email),
                                phone: asString(currentTenantRecord.phone),
                                country: asString(currentTenantRecord.country),
                                gender: normalizeGender(currentTenantRecord.gender),
                                language: normalizeLanguage(currentTenantRecord.language),
                                currency: normalizeCurrency(currentTenantRecord.currency),
                                rentalTypeDefault: asString(currentTenantRecord.rentalType),
                                dateOfBirth: normalizeDate(currentTenantRecord.dateOfBirth),
                                identityNo: asString(currentTenantRecord.identityNo),
                                passportExpiryDate: normalizeDate(currentTenantRecord.passportExpiryDate),
                                visaExpiryDate: normalizeDate(currentTenantRecord.visaExpiryDate),
                                address: asString(currentTenantRecord.address),
                                notes: asString(currentTenantRecord.notes),
                                isActive: true,
                                legacySource: 'nested-building-migration-current-tenant'
                            })

                            tenantId = tenantDoc._id as Types.ObjectId
                            tenantCache.set(currentTenantKey, tenantId)
                        }

                        pendingStays.push({
                            tenantId,
                            legacyBuildingId: buildingIdString,
                            legacyRoomId,
                            legacyTenantRoomNo: asString(currentTenantRecord.roomNo),
                            type: (asString(currentTenantRecord.rentalType) || 'monthly') as 'monthly' | 'daily' | 'contract',
                            status: 'active',
                            rentalStartDate: normalizeDate(currentTenantRecord.rentalStartDate),
                            rentalEndDate: normalizeDate(currentTenantRecord.rentalEndDate),
                            checkoutDate: normalizeDate(currentTenantRecord.checkoutDate),
                            roomRate: asNumber(currentTenantRecord.roomRate),
                            depositAmount: asNumber(currentTenantRecord.depositAmount),
                            electricityRate: asNumber(currentTenantRecord.electricityRate),
                            waterRate: asNumber(currentTenantRecord.waterRate),
                            electricityMeterStartAt: asNumber(currentTenantRecord.electricityMeterStartAt),
                            waterMeterStartAt: asNumber(currentTenantRecord.waterMeterStartAt),
                            notes: asString(currentTenantRecord.notes),
                            source: 'migration-current-tenant',
                            tenantNameSnapshot: asString(currentTenantRecord.name)
                        })
                    }
                }

                const finalRoomStatus = deriveRoomStatus({
                    legacyRoomStatus: legacyRoom.status,
                    stayDocs: pendingStays.map((stay) => ({
                        _id: new Types.ObjectId(),
                        tenantId: stay.tenantId,
                        tenantNameSnapshot: stay.tenantNameSnapshot,
                        rentalStartDate: stay.rentalStartDate,
                        rentalEndDate: stay.rentalEndDate,
                        checkoutDate: stay.checkoutDate,
                        status: stay.status
                    }))
                })

                const room = await Room.create({
                    buildingId: building._id,
                    legacyBuildingId: buildingIdString,
                    legacyRoomId,
                    name: roomName,
                    roomType: 'standard',
                    floor: null,
                    status: finalRoomStatus,
                    defaultRoomRate: asNumber(legacyRoom.roomRate ?? currentTenantRecord?.roomRate),
                    notes: asString(legacyRoom.notes),
                    isActive: true
                })

                const stayDocs: EnrichedStay[] = []

                for (const pendingStay of pendingStays) {
                    const stayDoc = await Stay.create({
                        buildingId: building._id,
                        roomId: room._id,
                        tenantId: pendingStay.tenantId,
                        legacyBuildingId: pendingStay.legacyBuildingId,
                        legacyRoomId: pendingStay.legacyRoomId,
                        legacyTenantRoomNo: pendingStay.legacyTenantRoomNo,
                        type: pendingStay.type,
                        status: pendingStay.status,
                        rentalStartDate: pendingStay.rentalStartDate,
                        rentalEndDate: pendingStay.rentalEndDate,
                        checkoutDate: pendingStay.checkoutDate,
                        roomRate: pendingStay.roomRate,
                        depositAmount: pendingStay.depositAmount,
                        electricityRate: pendingStay.electricityRate,
                        waterRate: pendingStay.waterRate,
                        electricityMeterStartAt: pendingStay.electricityMeterStartAt,
                        waterMeterStartAt: pendingStay.waterMeterStartAt,
                        notes: pendingStay.notes,
                        source: pendingStay.source
                    })

                    stayDocs.push({
                        _id: stayDoc._id as Types.ObjectId,
                        tenantId: pendingStay.tenantId,
                        tenantNameSnapshot: pendingStay.tenantNameSnapshot,
                        rentalStartDate: pendingStay.rentalStartDate,
                        rentalEndDate: pendingStay.rentalEndDate,
                        checkoutDate: pendingStay.checkoutDate,
                        status: pendingStay.status
                    })
                }

                const sortedStays = stayDocs
                    .slice()
                    .sort((a, b) => {
                        const left = normalizeDate(a.rentalStartDate)
                        const right = normalizeDate(b.rentalStartDate)
                        return left.localeCompare(right)
                    })

                const legacyInvoices = asRecordArray<LegacyInvoice>(legacyRoom.invoices)
                const seenInvoiceKeys = new Set<string>()

                for (let invoiceIndex = 0; invoiceIndex < legacyInvoices.length; invoiceIndex += 1) {
                    const legacyInvoice = legacyInvoices[invoiceIndex]

                    const invoiceUniqueKey = makeInvoiceUniqueKey(
                        legacyRoomId,
                        legacyInvoice.invoiceNo,
                        legacyInvoice.date,
                        invoiceIndex
                    )

                    if (seenInvoiceKeys.has(invoiceUniqueKey)) {
                        continue
                    }

                    seenInvoiceKeys.add(invoiceUniqueKey)

                    const matchedStay = chooseStayForInvoice(sortedStays, legacyInvoice)

                    const invoiceDoc = await Invoice.create({
                        buildingId: building._id,
                        roomId: room._id,
                        stayId: matchedStay ? matchedStay._id : null,
                        tenantId: matchedStay ? matchedStay.tenantId : null,
                        legacyBuildingId: buildingIdString,
                        legacyRoomId,
                        invoiceNo:
                            asString(legacyInvoice.invoiceNo) ||
                            `LEGACY-${legacyRoomId}-${invoiceIndex + 1}`,
                        date: normalizeDate(legacyInvoice.date) || '1970-01-01',
                        billingPeriodStart: '',
                        billingPeriodEnd: '',
                        roomRate: asNumber(legacyInvoice.roomRate),
                        nightlyRate:
                            legacyInvoice.nightlyRate === undefined
                                ? null
                                : asNumber(legacyInvoice.nightlyRate),
                        nights:
                            legacyInvoice.nights === undefined
                                ? null
                                : asNumber(legacyInvoice.nights),
                        stayStart: normalizeDate(legacyInvoice.stayStart),
                        stayEnd: normalizeDate(legacyInvoice.stayEnd),
                        electricityRate: asNumber(legacyInvoice.electricityRate),
                        waterRate: asNumber(legacyInvoice.waterRate),
                        oldElectricityReading: asNumber(legacyInvoice.oldElectricityReading),
                        electricityReading: asNumber(legacyInvoice.electricityReading),
                        electricityPrice: asNumber(legacyInvoice.electricityPrice),
                        oldWaterReading: asNumber(legacyInvoice.oldWaterReading),
                        waterReading: asNumber(legacyInvoice.waterReading),
                        waterPrice: asNumber(legacyInvoice.waterPrice),
                        services: asString(legacyInvoice.services),
                        servicesFee: asNumber(legacyInvoice.servicesFee),
                        others: asString(legacyInvoice.others),
                        othersFee: asNumber(legacyInvoice.othersFee),
                        previousBalance: asNumber(legacyInvoice.previousBalance),
                        totalAmount: asNumber(legacyInvoice.totalAmount),
                        totalAmountRiel: asNumber(legacyInvoice.totalAmountRiel),
                        status: normalizeInvoiceStatus(legacyInvoice.status),
                        outstandingAmount: asNumber(legacyInvoice.outstandingAmount),
                        tenantNameSnapshot: asString(legacyInvoice.tenantName),
                        tenantPhoneSnapshot: asString(legacyInvoice.tenantPhone),
                        tenantLanguageSnapshot: normalizeLanguage(legacyInvoice.tenantLanguage),
                        tenantCurrencySnapshot: normalizeCurrency(legacyInvoice.tenantCurrency),
                        tenantCheckInDateSnapshot: normalizeDate(legacyInvoice.tenantCheckInDate)
                    })

                    const paymentRecord = asRecord(legacyInvoice.payment) as LegacyInvoicePayment | null

                    if (paymentRecord) {
                        const paymentType = asString(paymentRecord.type) === 'partial' ? 'partial' : 'full'
                        const paymentAmount =
                            paymentRecord.amount !== undefined && paymentRecord.amount !== null
                                ? asNumber(paymentRecord.amount)
                                : asNumber(legacyInvoice.totalAmount)

                        if (paymentAmount > 0) {
                            await Payment.create({
                                invoiceId: invoiceDoc._id,
                                buildingId: building._id,
                                roomId: room._id,
                                stayId: matchedStay ? matchedStay._id : null,
                                tenantId: matchedStay ? matchedStay.tenantId : null,
                                paymentDate: normalizeDate(legacyInvoice.date) || '1970-01-01',
                                amount: paymentAmount,
                                type: paymentType,
                                method: 'cash',
                                notes: asString(paymentRecord.notes),
                                source: 'migration'
                            })
                        }
                    } else if (
                        normalizeInvoiceStatus(legacyInvoice.status) === 'Paid' &&
                        asNumber(legacyInvoice.totalAmount) > 0
                    ) {
                        await Payment.create({
                            invoiceId: invoiceDoc._id,
                            buildingId: building._id,
                            roomId: room._id,
                            stayId: matchedStay ? matchedStay._id : null,
                            tenantId: matchedStay ? matchedStay.tenantId : null,
                            paymentDate: normalizeDate(legacyInvoice.date) || '1970-01-01',
                            amount: asNumber(legacyInvoice.totalAmount),
                            type: 'full',
                            method: 'cash',
                            notes: 'Auto-created from legacy paid invoice status',
                            source: 'migration-auto'
                        })
                    }
                }

                const legacyReadings = asRecordArray<LegacyReading>(legacyRoom.readings)
                const readingSeen = new Set<string>()

                for (const legacyReading of legacyReadings) {
                    const readingDate = normalizeDate(legacyReading.date) || '1970-01-01'
                    const electricity = asNumber(legacyReading.electricity)
                    const water = asNumber(legacyReading.water)
                    const dedupeKey = [readingDate, electricity, water].join('::')

                    if (readingSeen.has(dedupeKey)) continue
                    readingSeen.add(dedupeKey)

                    const matchedStay = chooseStayForReading(sortedStays, readingDate)

                    await MeterReading.create({
                        buildingId: building._id,
                        roomId: room._id,
                        stayId: matchedStay ? matchedStay._id : null,
                        legacyBuildingId: buildingIdString,
                        legacyRoomId,
                        readingDate,
                        electricity,
                        water,
                        source: 'migration',
                        notes: ''
                    })
                }

                const legacyRoomServices = asRecordArray<LegacyService>(legacyRoom.services)

                for (const legacyService of legacyRoomServices) {
                    await Service.create({
                        buildingId: building._id,
                        roomId: room._id,
                        name: asString(legacyService.name) || 'Unnamed Service',
                        type: asString(legacyService.type) || 'general',
                        fee: asNumber(legacyService.fee),
                        date: normalizeDate(legacyService.date),
                        notes: '',
                        source: 'migration'
                    })
                }

                const contractFiles = asRecordArray<LegacyFile>(legacyRoom.contracts)

                for (const contractFile of contractFiles) {
                    await Document.create({
                        buildingId: building._id,
                        roomId: room._id,
                        tenantId: null,
                        stayId: null,
                        type: 'contract',
                        date: normalizeDate(contractFile.date) || '1970-01-01',
                        tenantNameSnapshot: asString(contractFile.tenantName),
                        fileName: asString(contractFile.fileName),
                        link: asString(contractFile.link),
                        notes: '',
                        source: 'migration'
                    })
                }

                const visaFiles = asRecordArray<LegacyFile>(legacyRoom.visaPhotos)

                for (const visaFile of visaFiles) {
                    await Document.create({
                        buildingId: building._id,
                        roomId: room._id,
                        tenantId: null,
                        stayId: null,
                        type: 'visa',
                        date: normalizeDate(visaFile.date) || '1970-01-01',
                        tenantNameSnapshot: asString(visaFile.tenantName),
                        fileName: asString(visaFile.fileName),
                        link: asString(visaFile.link),
                        notes: '',
                        source: 'migration'
                    })
                }

                const passportFiles = asRecordArray<LegacyFile>(legacyRoom.passportPhotos)

                for (const passportFile of passportFiles) {
                    await Document.create({
                        buildingId: building._id,
                        roomId: room._id,
                        tenantId: null,
                        stayId: null,
                        type: 'passport',
                        date: normalizeDate(passportFile.date) || '1970-01-01',
                        tenantNameSnapshot: asString(passportFile.tenantName),
                        fileName: asString(passportFile.fileName),
                        link: asString(passportFile.link),
                        notes: '',
                        source: 'migration'
                    })
                }

                const otherFiles = asRecordArray<LegacyFile>(legacyRoom.otherFiles)

                for (const otherFile of otherFiles) {
                    await Document.create({
                        buildingId: building._id,
                        roomId: room._id,
                        tenantId: null,
                        stayId: null,
                        type: 'other',
                        date: normalizeDate(otherFile.date) || '1970-01-01',
                        tenantNameSnapshot: asString(otherFile.tenantName),
                        fileName: asString(otherFile.fileName),
                        link: asString(otherFile.link),
                        notes: '',
                        source: 'migration'
                    })
                }
            }

            const legacyExpenses = asRecordArray<LegacyExpense>(legacyBuilding.expenses)

            for (const legacyExpense of legacyExpenses) {
                await Expense.create({
                    buildingId: building._id,
                    roomId: null,
                    name: asString(legacyExpense.name) || 'Unknown Expense',
                    type: asString(legacyExpense.type) || 'general',
                    date: normalizeDate(legacyExpense.date) || '1970-01-01',
                    amount: asNumber(legacyExpense.amount),
                    applyToRoomsType: asString(legacyExpense.applyToRoomsType) || 'general-expense',
                    selectedRoomIds: [],
                    notes: asString(legacyExpense.notes),
                    source: 'migration'
                })
            }

            const legacyBuildingServices = asRecordArray<LegacyService>(legacyBuilding.services)

            for (const legacyBuildingService of legacyBuildingServices) {
                await Service.create({
                    buildingId: building._id,
                    roomId: null,
                    name: asString(legacyBuildingService.name) || 'Unnamed Service',
                    type: asString(legacyBuildingService.type) || 'general',
                    fee: asNumber(legacyBuildingService.fee),
                    date: normalizeDate(legacyBuildingService.date),
                    notes: '',
                    source: 'migration'
                })
            }
        }

        console.log('[normalize] completed successfully')
    } finally {
        await mongoose.disconnect()
    }
}

void migrate().catch((error: unknown) => {
    console.error('[normalize] error:', error)
    process.exit(1)
})
