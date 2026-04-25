import { Types } from 'mongoose'
import Building from '../../models/Building'
import Room from '../../models/Room'
import Stay from '../../models/Stay'
import Tenant from '../../models/Tenant'
import Invoice from '../../models/Invoice'
import MeterReading from '../../models/MeterReading'
import DocumentModel from '../../models/Document'
import Service from '../../models/Service'
import {
    compareDateAsc,
    compareDateDesc,
    normalizeRoomStatus,
    toNullableNumber,
    toNumber,
    toObjectIdString,
    toStringValue
} from './room.helpers'
import { getEffectiveStayStatus, type EffectiveStayStatus } from '../stay/stay.helpers'
import type { RoomDetailResponse, RoomDetailDocumentType } from './room.types'

type LeanRoom = {
    _id: Types.ObjectId
    accountId?: Types.ObjectId
    buildingId: Types.ObjectId
    legacyBuildingId?: string
    legacyRoomId?: string
    name: string
    roomType?: string
    floor?: number | null
    status?: string
    defaultRoomRate?: number
    blockedFrom?: string
    blockedTo?: string
    blockedRemarks?: string
    notes?: string
    isActive?: boolean
}

type LeanStay = {
    _id: Types.ObjectId
    tenantId: Types.ObjectId
    status?: string
    type?: string
    rentalStartDate?: string
    rentalEndDate?: string
    checkoutDate?: string
    cancelledAt?: string
    roomRate?: number
    depositAmount?: number
    electricityRate?: number
    waterRate?: number
    electricityMeterStartAt?: number
    waterMeterStartAt?: number
    notes?: string
}

type LeanTenant = {
    _id: Types.ObjectId
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

type LeanReading = {
    _id: Types.ObjectId
    readingDate: string
    electricity?: number
    water?: number
    notes?: string
}

type LeanInvoice = {
    _id: Types.ObjectId
    invoiceNo: string
    date: string
    billingPeriodStart?: string
    billingPeriodEnd?: string
    roomRate?: number
    nightlyRate?: number | null
    nights?: number | null
    stayStart?: string
    stayEnd?: string
    electricityRate?: number
    waterRate?: number
    oldElectricityReading?: number
    electricityReading?: number
    electricityPrice?: number
    oldWaterReading?: number
    waterReading?: number
    waterPrice?: number
    services?: string
    servicesFee?: number
    others?: string
    othersFee?: number
    previousBalance?: number
    totalAmount?: number
    totalAmountRiel?: number
    status?: string
    outstandingAmount?: number
    tenantNameSnapshot?: string
    tenantPhoneSnapshot?: string
    tenantLanguageSnapshot?: 'english' | 'khmer' | 'chinese' | 'japanese' | 'korean'
    tenantCurrencySnapshot?: 'USD' | 'Riel'
    tenantCheckInDateSnapshot?: string
}

type LeanDocument = {
    _id: Types.ObjectId
    type: RoomDetailDocumentType
    date: string
    tenantNameSnapshot?: string
    link: string
    fileName?: string
    notes?: string
}

type LeanService = {
    _id: Types.ObjectId
    name: string
    type?: string
    fee?: number
    date?: string
    notes?: string
}

type CreateRoomInput = {
    name?: string
    roomType?: string
    floor?: number | null
    status?: string
    defaultRoomRate?: number
    blockedFrom?: string
    blockedTo?: string
    blockedRemarks?: string
    notes?: string
}

type UpdateRoomInput = {
    name?: string
    roomType?: string
    floor?: number | null
    status?: string
    defaultRoomRate?: number
    blockedFrom?: string
    blockedTo?: string
    blockedRemarks?: string
    notes?: string
    isActive?: boolean
}

type RoomLookup = {
    $or: Array<Record<string, unknown>>
}

type MappedStay = {
    _id: string
    tenantId: string
    tenantName: string
    tenantEmail: string
    tenantPhone: string
    tenantBusinessSource: string
    tenantCountry: string
    tenantGender: string
    tenantLanguage: string
    tenantCurrency: string
    tenantDateOfBirth: string
    tenantIdentityNo: string
    tenantPassportExpiryDate: string
    tenantVisaExpiryDate: string
    tenantAddress: string
    tenantNotes: string
    type: string
    status: EffectiveStayStatus
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
}

type MappedDocument = {
    _id: string
    type: RoomDetailDocumentType
    date: string
    tenantName: string
    link: string
    fileName: string
    notes: string
}

function buildRoomLookup(id: string): RoomLookup {
    const conditions: Array<Record<string, unknown>> = []

    if (Types.ObjectId.isValid(id)) {
        conditions.push({ _id: new Types.ObjectId(id) })
    }

    conditions.push({ legacyRoomId: id })

    return { $or: conditions }
}

function mapStay(stay: LeanStay, tenant?: LeanTenant): MappedStay {
    return {
        _id: toObjectIdString(stay._id),
        tenantId: toObjectIdString(stay.tenantId),
        tenantName: tenant?.fullName ?? '',
        tenantEmail: tenant?.email ?? '',
        tenantPhone: tenant?.phone ?? '',
        tenantBusinessSource: tenant?.businessSource ?? '',
        tenantCountry: tenant?.country ?? '',
        tenantGender: tenant?.gender ?? '',
        tenantLanguage: tenant?.language ?? 'english',
        tenantCurrency: tenant?.currency ?? 'USD',
        tenantDateOfBirth: tenant?.dateOfBirth ?? '',
        tenantIdentityNo: tenant?.identityNo ?? '',
        tenantPassportExpiryDate: tenant?.passportExpiryDate ?? '',
        tenantVisaExpiryDate: tenant?.visaExpiryDate ?? '',
        tenantAddress: tenant?.address ?? '',
        tenantNotes: tenant?.notes ?? '',
        type: stay.type ?? 'monthly',
        status: getEffectiveStayStatus(stay),
        rentalStartDate: stay.rentalStartDate ?? '',
        rentalEndDate: stay.rentalEndDate ?? '',
        checkoutDate: stay.checkoutDate ?? '',
        roomRate: stay.roomRate ?? 0,
        depositAmount: stay.depositAmount ?? 0,
        electricityRate: stay.electricityRate ?? 0,
        waterRate: stay.waterRate ?? 0,
        electricityMeterStartAt: stay.electricityMeterStartAt ?? 0,
        waterMeterStartAt: stay.waterMeterStartAt ?? 0,
        notes: stay.notes ?? ''
    }
}

function mapDocument(doc: LeanDocument): MappedDocument {
    return {
        _id: toObjectIdString(doc._id),
        type: doc.type,
        date: doc.date,
        tenantName: doc.tenantNameSnapshot ?? '',
        link: doc.link,
        fileName: doc.fileName ?? '',
        notes: doc.notes ?? ''
    }
}

function pickCurrentStay(stays: MappedStay[], roomStatus?: string): MappedStay | undefined {
    const active = stays.find((stay) => stay.status === 'active')
    if (active) return active

    const reserved = stays.find((stay) => stay.status === 'reserved')
    if (reserved) return reserved

    const normalizedRoomStatus = String(roomStatus ?? '').trim().toLowerCase()

    if (normalizedRoomStatus === 'occupied' || normalizedRoomStatus === 'reserved') {
        const latestCheckedOut = stays.find((stay) => stay.status === 'checked_out')
        if (latestCheckedOut) return latestCheckedOut
    }

    return undefined
}

export async function createRoom(buildingId: string, input: CreateRoomInput) {
    const building = await Building.findById(buildingId)
    if (!building) {
        return { status: 'building_not_found' as const }
    }

    const name = toStringValue(input.name)
    if (!name) {
        return { status: 'invalid_name' as const }
    }

    const existingRoom = await Room.findOne({
        buildingId: building._id,
        name
    })

    if (existingRoom) {
        return { status: 'duplicate_room' as const }
    }

    const room = await Room.create({
        accountId: building.accountId ?? undefined,
        buildingId: building._id,
        legacyBuildingId: building.legacyBuildingId ?? '',
        legacyRoomId: '',
        name,
        roomType: toStringValue(input.roomType) || 'standard',
        floor: toNullableNumber(input.floor),
        status: normalizeRoomStatus(input.status),
        defaultRoomRate: toNumber(input.defaultRoomRate, 0),
        notes: toStringValue(input.notes),
        isActive: true
    })

    return { status: 'created' as const, room }
}

export async function updateRoom(id: string, input: UpdateRoomInput) {
    const room = await Room.findOne(buildRoomLookup(id))
    if (!room) {
        return { status: 'room_not_found' as const }
    }

    if (input.name !== undefined) {
        const nextName = toStringValue(input.name)
        if (!nextName) {
            return { status: 'invalid_name' as const }
        }

        const duplicate = await Room.findOne({
            _id: { $ne: room._id },
            buildingId: room.buildingId,
            name: nextName
        })

        if (duplicate) {
            return { status: 'duplicate_room' as const }
        }

        room.name = nextName
    }

    if (input.roomType !== undefined) room.roomType = toStringValue(input.roomType) || 'standard'
    if (input.floor !== undefined) room.floor = toNullableNumber(input.floor)
    if (input.status !== undefined) room.status = normalizeRoomStatus(input.status)
    if (input.defaultRoomRate !== undefined) room.defaultRoomRate = toNumber(input.defaultRoomRate, 0)
    if (input.blockedFrom !== undefined) room.blockedFrom = toStringValue(input.blockedFrom)
    if (input.blockedTo !== undefined) room.blockedTo = toStringValue(input.blockedTo)
    if (input.blockedRemarks !== undefined) room.blockedRemarks = toStringValue(input.blockedRemarks)
    if (input.notes !== undefined) room.notes = toStringValue(input.notes)
    if (typeof input.isActive === 'boolean') room.isActive = input.isActive

    await room.save()

    return { status: 'updated' as const, room }
}

export async function getRoomDetail(id: string): Promise<RoomDetailResponse | null> {
    const room = (await Room.findOne(buildRoomLookup(id)).lean()) as LeanRoom | null
    if (!room) return null

    const [staysRaw, readingsRaw, invoicesRaw, documentsRaw, servicesRaw] = await Promise.all([
        Stay.find({ roomId: room._id }).lean(),
        MeterReading.find({ roomId: room._id }).lean(),
        Invoice.find({ roomId: room._id }).lean(),
        DocumentModel.find({ roomId: room._id }).lean(),
        Service.find({ roomId: room._id }).lean()
    ])

    const stays = staysRaw as LeanStay[]
    const readings = readingsRaw as LeanReading[]
    const invoices = invoicesRaw as LeanInvoice[]
    const documents = documentsRaw as LeanDocument[]
    const services = servicesRaw as LeanService[]

    const tenantIds = Array.from(
        new Set(stays.map((stay) => toObjectIdString(stay.tenantId)).filter(Boolean))
    )

    const tenantsRaw = tenantIds.length
        ? await Tenant.find({ _id: { $in: tenantIds } }).lean()
        : []

    const tenants = tenantsRaw as LeanTenant[]

    const tenantById = new Map<string, LeanTenant>(
        tenants.map((tenant) => [toObjectIdString(tenant._id), tenant])
    )

    const mappedStays = stays
        .slice()
        .sort((a, b) => compareDateDesc(a.rentalStartDate, b.rentalStartDate))
        .map((stay) => mapStay(stay, tenantById.get(toObjectIdString(stay.tenantId))))

    const currentStay = pickCurrentStay(mappedStays, room.status)

    const mappedReadings = readings
        .slice()
        .sort((a, b) => compareDateAsc(a.readingDate, b.readingDate))
        .map((reading) => ({
            _id: toObjectIdString(reading._id),
            readingDate: reading.readingDate,
            electricity: reading.electricity ?? 0,
            water: reading.water ?? 0,
            notes: reading.notes ?? ''
        }))

    const mappedInvoices = invoices
        .slice()
        .sort((a, b) => compareDateDesc(a.date, b.date))
        .map((invoice) => ({
            _id: toObjectIdString(invoice._id),
            invoiceNo: invoice.invoiceNo,
            date: invoice.date,
            billingPeriodStart: invoice.billingPeriodStart ?? '',
            billingPeriodEnd: invoice.billingPeriodEnd ?? '',
            roomRate: invoice.roomRate ?? 0,
            nightlyRate: invoice.nightlyRate ?? null,
            nights: invoice.nights ?? null,
            stayStart: invoice.stayStart ?? '',
            stayEnd: invoice.stayEnd ?? '',
            electricityRate: invoice.electricityRate ?? 0,
            waterRate: invoice.waterRate ?? 0,
            oldElectricityReading: invoice.oldElectricityReading ?? 0,
            electricityReading: invoice.electricityReading ?? 0,
            electricityPrice: invoice.electricityPrice ?? 0,
            oldWaterReading: invoice.oldWaterReading ?? 0,
            waterReading: invoice.waterReading ?? 0,
            waterPrice: invoice.waterPrice ?? 0,
            services: invoice.services ?? '',
            servicesFee: invoice.servicesFee ?? 0,
            others: invoice.others ?? '',
            othersFee: invoice.othersFee ?? 0,
            previousBalance: invoice.previousBalance ?? 0,
            totalAmount: invoice.totalAmount ?? 0,
            totalAmountRiel: invoice.totalAmountRiel ?? 0,
            status: invoice.status ?? 'Not paid',
            outstandingAmount: invoice.outstandingAmount ?? 0,
            tenantName: invoice.tenantNameSnapshot ?? '',
            tenantPhone: invoice.tenantPhoneSnapshot ?? '',
            tenantLanguage: invoice.tenantLanguageSnapshot ?? 'english',
            tenantCurrency: invoice.tenantCurrencySnapshot ?? 'USD',
            tenantCheckInDate: invoice.tenantCheckInDateSnapshot ?? ''
        }))

    const mappedServices = services
        .slice()
        .sort((a, b) => compareDateDesc(a.date, b.date))
        .map((service) => ({
            _id: toObjectIdString(service._id),
            name: service.name,
            type: service.type ?? 'general',
            fee: service.fee ?? 0,
            date: service.date ?? '',
            notes: service.notes ?? ''
        }))

    const contracts = documents
        .filter((doc) => doc.type === 'contract')
        .sort((a, b) => compareDateDesc(a.date, b.date))
        .map(mapDocument)

    const visaPhotos = documents
        .filter((doc) => doc.type === 'visa')
        .sort((a, b) => compareDateDesc(a.date, b.date))
        .map(mapDocument)

    const passportPhotos = documents
        .filter((doc) => doc.type === 'passport')
        .sort((a, b) => compareDateDesc(a.date, b.date))
        .map(mapDocument)

    const others = documents
        .filter((doc) => doc.type === 'other')
        .sort((a, b) => compareDateDesc(a.date, b.date))
        .map(mapDocument)

    return {
        room: {
            _id: toObjectIdString(room._id),
            buildingId: toObjectIdString(room.buildingId),
            legacyBuildingId: room.legacyBuildingId ?? '',
            legacyRoomId: room.legacyRoomId ?? '',
            name: room.name,
            roomType: room.roomType ?? 'standard',
            floor: room.floor ?? null,
            status: room.status ?? 'Vacant',
            defaultRoomRate: room.defaultRoomRate ?? 0,
            blockedFrom: room.blockedFrom ?? '',
            blockedTo: room.blockedTo ?? '',
            blockedRemarks: room.blockedRemarks ?? '',
            notes: room.notes ?? '',
            isActive: room.isActive ?? true
        },
        currentStay,
        stays: mappedStays,
        readings: mappedReadings,
        invoices: mappedInvoices,
        services: mappedServices,
        documents: {
            contracts,
            visaPhotos,
            passportPhotos,
            others
        }
    }
}
