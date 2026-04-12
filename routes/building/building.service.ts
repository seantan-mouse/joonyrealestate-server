import { Types } from 'mongoose'
import Building from '../../models/Building'
import Room from '../../models/Room'
import Stay from '../../models/Stay'
import Tenant from '../../models/Tenant'
import Invoice from '../../models/Invoice'
import User from '../../models/User'
import Payment from '../../models/Payment'
import MeterReading from '../../models/MeterReading'
import Expense from '../../models/Expense'
import Service from '../../models/Service'
import DocumentModel from '../../models/Document'
import {
    compareStoredDateAsc,
    compareStoredDateDesc,
    getTodayIsoDate,
    parseStoredDate
} from '../common/dates'
import { getEffectiveStayStatus } from '../stay/stay.helpers'
import type {
    BuildingDetailDto,
    BuildingOccupancyDto,
    BuildingOccupancyRoomDto,
    BuildingOccupancyStayDto,
    BuildingRoomsCurrentStayDto,
    BuildingRoomsDto,
    BuildingRoomsLatestInvoiceDto,
    BuildingRoomsRoomDto,
    BuildingSettingsDto,
    BuildingSummaryDto,
    LeanBuilding,
    LeanInvoice,
    LeanPayment,
    LeanRoom,
    LeanStay,
    LeanTenant,
    PaymentsOverviewDto,
    PaymentsOverviewInvoiceDto,
    PaymentsOverviewPaymentDto,
    PaymentsOverviewRoomDto,
    Primitive,
    RoomStatus,
    StayStatus
} from './building.types'

type UserAccessDoc = {
    accessToBuildings?: Array<string | Types.ObjectId>
} | null

function toObjectIdString(value: Primitive | Types.ObjectId): string {
    if (value instanceof Types.ObjectId) return value.toString()
    return String(value ?? '')
}

function getDisplayStayStatus(stay: LeanStay): StayStatus {
    const cancelledAt = String(stay.cancelledAt ?? '').trim()
    const checkoutDate = String(stay.checkoutDate ?? '').trim()
    const rentalStartDate = String(stay.rentalStartDate ?? '').trim()
    const rentalEndDate = String(stay.rentalEndDate ?? '').trim()
    const today = getTodayIsoDate()

    if (cancelledAt) return 'cancelled'
    if (checkoutDate) return 'checked_out'
    if (rentalStartDate && rentalStartDate > today) return 'reserved'
    if (rentalEndDate && rentalEndDate < today) return 'checked_out'

    return 'active'
}

function normalizeRoomStatus(value?: string): RoomStatus {
    if (value === 'Occupied') return 'Occupied'
    if (value === 'Reserved') return 'Reserved'
    if (value === 'Maintenance') return 'Maintenance'
    return 'Vacant'
}

function compareDateAsc(a?: string, b?: string): number {
    return compareStoredDateAsc(a, b)
}

function compareDateDesc(a?: string, b?: string): number {
    return compareStoredDateDesc(a, b)
}

function toBuildingSettingsDto(building: LeanBuilding): BuildingSettingsDto {
    return {
        roomsPerRow: building.settings?.roomsPerRow ?? 8,
        interestRate: building.settings?.interestRate ?? 0
    }
}

function mapBuildingSummary(building: LeanBuilding, rooms: LeanRoom[]): BuildingSummaryDto {
    let occupiedRoomCount = 0
    let reservedRoomCount = 0
    let vacantRoomCount = 0
    let maintenanceRoomCount = 0

    for (const room of rooms) {
        const status = normalizeRoomStatus(room.status)

        if (status === 'Occupied') occupiedRoomCount += 1
        else if (status === 'Reserved') reservedRoomCount += 1
        else if (status === 'Maintenance') maintenanceRoomCount += 1
        else vacantRoomCount += 1
    }

    return {
        _id: toObjectIdString(building._id),
        name: building.name,
        code: building.code ?? '',
        notes: building.notes ?? '',
        isActive: building.isActive ?? true,
        settings: toBuildingSettingsDto(building),
        roomCount: rooms.length,
        occupiedRoomCount,
        reservedRoomCount,
        vacantRoomCount,
        maintenanceRoomCount
    }
}

function mapBuildingDetail(building: LeanBuilding): BuildingDetailDto {
    return {
        _id: toObjectIdString(building._id),
        name: building.name,
        code: building.code ?? '',
        notes: building.notes ?? '',
        isActive: building.isActive ?? true,
        settings: toBuildingSettingsDto(building)
    }
}

function mapCurrentStayDto(stay: LeanStay, tenant?: LeanTenant): BuildingRoomsCurrentStayDto {
    return {
        _id: toObjectIdString(stay._id),
        tenantId: toObjectIdString(stay.tenantId),
        tenantName: tenant?.fullName ?? '',
        type: stay.type ?? 'monthly',
        status: getDisplayStayStatus(stay),
        rentalStartDate: stay.rentalStartDate ?? '',
        rentalEndDate: stay.rentalEndDate ?? '',
        checkoutDate: stay.checkoutDate ?? '',
        roomRate: stay.roomRate ?? 0,
        depositAmount: stay.depositAmount ?? 0,
        electricityRate: stay.electricityRate ?? 0,
        waterRate: stay.waterRate ?? 0
    }
}

function mapOccupancyStayDto(stay: LeanStay, tenant?: LeanTenant): BuildingOccupancyStayDto {
    return {
        _id: toObjectIdString(stay._id),
        tenantId: toObjectIdString(stay.tenantId),
        tenantName: tenant?.fullName ?? '',
        type: stay.type ?? 'monthly',
        status: getDisplayStayStatus(stay),
        rentalStartDate: stay.rentalStartDate ?? '',
        rentalEndDate: stay.rentalEndDate ?? '',
        checkoutDate: stay.checkoutDate ?? ''
    }
}

function mapLatestInvoiceDto(invoice: LeanInvoice): BuildingRoomsLatestInvoiceDto {
    return {
        _id: toObjectIdString(invoice._id),
        invoiceNo: invoice.invoiceNo,
        date: invoice.date,
        status: invoice.status ?? 'Not paid',
        totalAmount: invoice.totalAmount ?? 0,
        outstandingAmount: invoice.outstandingAmount ?? 0
    }
}

function mapPaymentsOverviewPaymentDto(payment: LeanPayment): PaymentsOverviewPaymentDto {
    return {
        _id: toObjectIdString(payment._id),
        paymentDate: payment.paymentDate ?? '',
        amount: payment.amount ?? 0,
        type: payment.type === 'partial' ? 'partial' : 'full',
        method:
            payment.method === 'bank' ||
            payment.method === 'khqr' ||
            payment.method === 'card' ||
            payment.method === 'other'
                ? payment.method
                : 'cash',
        notes: payment.notes ?? ''
    }
}

function mapPaymentsOverviewInvoiceDto(params: {
    invoice: LeanInvoice
    room: LeanRoom
    payment: LeanPayment | null
}): PaymentsOverviewInvoiceDto {
    const { invoice, room, payment } = params

    return {
        _id: toObjectIdString(invoice._id),
        roomId: toObjectIdString(room._id),
        roomName: room.name,
        tenantId: invoice.tenantId ? toObjectIdString(invoice.tenantId) : null,
        tenantName: invoice.tenantNameSnapshot ?? '',
        tenantPhone: (invoice as LeanInvoice & { tenantPhoneSnapshot?: string }).tenantPhoneSnapshot ?? '',
        tenantLanguage:
            ((invoice as LeanInvoice & {
                tenantLanguageSnapshot?: 'english' | 'khmer' | 'chinese' | 'japanese' | 'korean'
            }).tenantLanguageSnapshot) ?? 'english',
        tenantCurrency:
            ((invoice as LeanInvoice & {
                tenantCurrencySnapshot?: 'USD' | 'Riel'
            }).tenantCurrencySnapshot) ?? 'USD',
        tenantCheckInDate:
            (invoice as LeanInvoice & { tenantCheckInDateSnapshot?: string }).tenantCheckInDateSnapshot ?? '',
        invoiceNo: invoice.invoiceNo,
        date: invoice.date,
        billingPeriodStart:
            (invoice as LeanInvoice & { billingPeriodStart?: string }).billingPeriodStart ?? '',
        billingPeriodEnd:
            (invoice as LeanInvoice & { billingPeriodEnd?: string }).billingPeriodEnd ?? '',
        roomRate: (invoice as LeanInvoice & { roomRate?: number }).roomRate ?? 0,
        nightlyRate: (invoice as LeanInvoice & { nightlyRate?: number | null }).nightlyRate ?? null,
        nights: (invoice as LeanInvoice & { nights?: number | null }).nights ?? null,
        stayStart: (invoice as LeanInvoice & { stayStart?: string }).stayStart ?? '',
        stayEnd: (invoice as LeanInvoice & { stayEnd?: string }).stayEnd ?? '',
        electricityRate: (invoice as LeanInvoice & { electricityRate?: number }).electricityRate ?? 0,
        waterRate: (invoice as LeanInvoice & { waterRate?: number }).waterRate ?? 0,
        oldElectricityReading:
            (invoice as LeanInvoice & { oldElectricityReading?: number }).oldElectricityReading ?? 0,
        electricityReading:
            (invoice as LeanInvoice & { electricityReading?: number }).electricityReading ?? 0,
        electricityPrice:
            (invoice as LeanInvoice & { electricityPrice?: number }).electricityPrice ?? 0,
        oldWaterReading:
            (invoice as LeanInvoice & { oldWaterReading?: number }).oldWaterReading ?? 0,
        waterReading: (invoice as LeanInvoice & { waterReading?: number }).waterReading ?? 0,
        waterPrice: (invoice as LeanInvoice & { waterPrice?: number }).waterPrice ?? 0,
        services: (invoice as LeanInvoice & { services?: string }).services ?? '',
        servicesFee: (invoice as LeanInvoice & { servicesFee?: number }).servicesFee ?? 0,
        others: (invoice as LeanInvoice & { others?: string }).others ?? '',
        othersFee: (invoice as LeanInvoice & { othersFee?: number }).othersFee ?? 0,
        previousBalance:
            (invoice as LeanInvoice & { previousBalance?: number }).previousBalance ?? 0,
        totalAmount: invoice.totalAmount ?? 0,
        totalAmountRiel:
            (invoice as LeanInvoice & { totalAmountRiel?: number }).totalAmountRiel ?? 0,
        status:
            invoice.status === 'Paid' ||
            invoice.status === 'Partially paid' ||
            invoice.status === 'Voided'
                ? invoice.status
                : 'Not paid',
        outstandingAmount: invoice.outstandingAmount ?? 0,
        payment: payment ? mapPaymentsOverviewPaymentDto(payment) : null
    }
}

function getEffectiveRoomStatus(room: LeanRoom, currentStay: LeanStay | null): RoomStatus {
    const persistedStatus = normalizeRoomStatus(room.status)

    if (persistedStatus === 'Maintenance') {
        return 'Maintenance'
    }

    if (!currentStay) {
        return 'Vacant'
    }

    const stayStatus = getDisplayStayStatus(currentStay)

    if (stayStatus === 'active') {
        return 'Occupied'
    }

    if (stayStatus === 'reserved') {
        return 'Reserved'
    }

    if (
        stayStatus === 'checked_out' &&
        (persistedStatus === 'Occupied' || persistedStatus === 'Reserved')
    ) {
        return persistedStatus
    }

    return 'Vacant'
}

function pickCurrentStay(stays: LeanStay[], roomStatus?: string): LeanStay | null {
    const sorted = stays
        .slice()
        .sort((a, b) => compareDateDesc(a.rentalStartDate, b.rentalStartDate))

    const active = sorted.find((stay) => getDisplayStayStatus(stay) === 'active')
    if (active) return active

    const reserved = sorted.find((stay) => getDisplayStayStatus(stay) === 'reserved')
    if (reserved) return reserved

    const normalizedRoomStatus = String(roomStatus ?? '').trim().toLowerCase()

    if (normalizedRoomStatus === 'occupied' || normalizedRoomStatus === 'reserved') {
        const latestCheckedOut = sorted.find((stay) => getDisplayStayStatus(stay) === 'checked_out')
        if (latestCheckedOut) return latestCheckedOut
    }

    return null
}

function computeNextInvoiceDate(
    currentStay: LeanStay | null,
    latestInvoice: LeanInvoice | null
): string | null {
    if (!currentStay) return null
    if ((currentStay.type ?? 'monthly') === 'contract') return null

    const rentalStartDate = String(currentStay.rentalStartDate ?? '').trim()
    if (!rentalStartDate) return null

    const start = parseStoredDate(rentalStartDate)
    if (!start) return null

    const billDay = start.date()

    if (!latestInvoice?.date) {
        return start.format('YYYY-MM-DD')
    }

    const latest = parseStoredDate(latestInvoice.date)
    if (!latest) return start.format('YYYY-MM-DD')

    const nextMonth = latest.startOf('month').add(1, 'month')
    const next = nextMonth.date(Math.min(billDay, nextMonth.daysInMonth()))

    return next.format('YYYY-MM-DD')
}

function computeRoomOverdue(
    roomInvoices: LeanInvoice[],
    currentStay: LeanStay | null,
    tenant?: LeanTenant
): {
    hasOverdue: boolean
    overdueDays: number
    totalOutstanding: number
} {
    if (!currentStay) {
        return {
            hasOverdue: false,
            overdueDays: 0,
            totalOutstanding: 0
        }
    }

    if ((currentStay.type ?? 'monthly') === 'contract') {
        return {
            hasOverdue: false,
            overdueDays: 0,
            totalOutstanding: 0
        }
    }

    const tenantId = toObjectIdString(currentStay.tenantId)
    const tenantName = String(tenant?.fullName ?? '').trim()

    const matched = roomInvoices.filter((invoice) => {
        const invoiceTenantId = invoice.tenantId ? toObjectIdString(invoice.tenantId) : ''
        const invoiceTenantName = String(invoice.tenantNameSnapshot ?? '').trim()

        if (invoiceTenantId && invoiceTenantId === tenantId) return true
        if (!invoiceTenantId && tenantName && invoiceTenantName === tenantName) return true

        return false
    })

    const unpaid = matched.filter((invoice) => {
        const outstanding = invoice.outstandingAmount ?? invoice.totalAmount ?? 0
        return outstanding > 0 && (invoice.status ?? 'Not paid') !== 'Voided'
    })

    if (unpaid.length === 0) {
        return {
            hasOverdue: false,
            overdueDays: 0,
            totalOutstanding: 0
        }
    }

    const sorted = unpaid
        .slice()
        .sort((a, b) => compareDateAsc(a.date, b.date))

    const oldest = sorted[0]
    const oldestDate = parseStoredDate(oldest.date)
    const today = parseStoredDate(getTodayIsoDate())

    let overdueDays = 0

    if (oldestDate && today) {
        overdueDays = Math.max(0, today.diff(oldestDate, 'day'))
    }

    const totalOutstanding = unpaid.reduce((sum, invoice) => {
        return sum + (invoice.outstandingAmount ?? invoice.totalAmount ?? 0)
    }, 0)

    return {
        hasOverdue: totalOutstanding > 0,
        overdueDays,
        totalOutstanding
    }
}

async function fetchRoomsByBuildingIds(buildingIds: Types.ObjectId[]): Promise<LeanRoom[]> {
    if (buildingIds.length === 0) return []
    return Room.find({ buildingId: { $in: buildingIds } }).lean<LeanRoom[]>()
}

function requireObjectId(id: string): Types.ObjectId | null {
    if (!Types.ObjectId.isValid(id)) return null
    return new Types.ObjectId(id)
}

function requireAccountObjectId(accountId?: string): Types.ObjectId | null {
    if (!accountId || !Types.ObjectId.isValid(accountId)) return null
    return new Types.ObjectId(accountId)
}

export async function getAllBuildingsSummary(accountId?: string): Promise<BuildingSummaryDto[]> {
    const accountObjectId = requireAccountObjectId(accountId)
    if (!accountObjectId) return []

    const buildings = await Building.find({ accountId: accountObjectId }).lean<LeanBuilding[]>()
    const buildingIds = buildings.map((building) => building._id)
    const rooms = await fetchRoomsByBuildingIds(buildingIds)

    const roomsByBuildingId = new Map<string, LeanRoom[]>()

    for (const room of rooms) {
        const key = toObjectIdString(room.buildingId)
        const existing = roomsByBuildingId.get(key) ?? []
        existing.push(room)
        roomsByBuildingId.set(key, existing)
    }

    return buildings
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((building) =>
            mapBuildingSummary(building, roomsByBuildingId.get(toObjectIdString(building._id)) ?? [])
        )
}

export async function getBuildingsForUser(userId: string, accountId?: string): Promise<BuildingSummaryDto[] | null> {
    if (!Types.ObjectId.isValid(userId)) return null
    const accountObjectId = requireAccountObjectId(accountId)
    if (!accountObjectId) return []

    const user = await User.findOne({
        _id: userId,
        accountId: accountObjectId
    }).lean<UserAccessDoc>()
    if (!user) return null

    const accessIds = Array.isArray(user.accessToBuildings)
        ? user.accessToBuildings.map((value) => String(value))
        : []

    const objectIds = accessIds
        .filter((value) => Types.ObjectId.isValid(value))
        .map((value) => new Types.ObjectId(value))

    const buildings = await Building.find({
        accountId: accountObjectId,
        _id: { $in: objectIds }
    }).lean<LeanBuilding[]>()

    const buildingIds = buildings.map((building) => building._id)
    const rooms = await fetchRoomsByBuildingIds(buildingIds)

    const roomsByBuildingId = new Map<string, LeanRoom[]>()

    for (const room of rooms) {
        const key = toObjectIdString(room.buildingId)
        const existing = roomsByBuildingId.get(key) ?? []
        existing.push(room)
        roomsByBuildingId.set(key, existing)
    }

    return buildings
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((building) =>
            mapBuildingSummary(building, roomsByBuildingId.get(toObjectIdString(building._id)) ?? [])
        )
}

export async function createBuilding(accountId: string | undefined, input: {
    name?: string
    code?: string
    notes?: string
    settings?: {
        roomsPerRow?: number
        interestRate?: number
    }
}): Promise<{ status: 'exists' } | { status: 'created'; building: BuildingDetailDto }> {
    const accountObjectId = requireAccountObjectId(accountId)
    if (!accountObjectId) {
        return { status: 'exists' }
    }

    const name = String(input.name ?? '').trim()

    const existing = await Building.findOne({ accountId: accountObjectId, name })
    if (existing) {
        return { status: 'exists' }
    }

    const building = await Building.create({
        accountId: accountObjectId,
        name,
        code: String(input.code ?? '').trim(),
        notes: String(input.notes ?? '').trim(),
        settings: {
            roomsPerRow: Number(input.settings?.roomsPerRow ?? 8),
            interestRate: Number(input.settings?.interestRate ?? 0)
        },
        isActive: true
    })

    return {
        status: 'created',
        building: {
            _id: toObjectIdString(building._id),
            name: building.name,
            code: building.code ?? '',
            notes: building.notes ?? '',
            isActive: building.isActive ?? true,
            settings: {
                roomsPerRow: building.settings?.roomsPerRow ?? 8,
                interestRate: building.settings?.interestRate ?? 0
            }
        }
    }
}

export async function updateBuildingById(
    id: string,
    accountId: string | undefined,
    input: {
        name?: string
        code?: string
        notes?: string
        settings?: {
            roomsPerRow?: number
            interestRate?: number
        }
        isActive?: boolean
    }
): Promise<{ status: 'not_found' } | { status: 'exists' } | { status: 'updated'; building: BuildingDetailDto }> {
    const objectId = requireObjectId(id)
    const accountObjectId = requireAccountObjectId(accountId)
    if (!objectId || !accountObjectId) return { status: 'not_found' }

    const existing = await Building.findOne({
        _id: objectId,
        accountId: accountObjectId
    })
    if (!existing) return { status: 'not_found' }

    const nextName = input.name === undefined
        ? existing.name
        : String(input.name).trim()

    if (!nextName) {
        return { status: 'exists' }
    }

    const duplicate = await Building.findOne({
        _id: { $ne: objectId },
        accountId: accountObjectId,
        name: nextName
    }).select('_id')

    if (duplicate) {
        return { status: 'exists' }
    }

    existing.name = nextName

    if (input.code !== undefined) {
        existing.code = String(input.code).trim()
    }

    if (input.notes !== undefined) {
        existing.notes = String(input.notes).trim()
    }

    if (input.isActive !== undefined) {
        existing.isActive = Boolean(input.isActive)
    }

    if (input.settings) {
        const currentSettings = existing.settings ?? { roomsPerRow: 8, interestRate: 0 }

        if (input.settings.roomsPerRow !== undefined) {
            const roomsPerRow = Number(input.settings.roomsPerRow)
            currentSettings.roomsPerRow = Number.isFinite(roomsPerRow) && roomsPerRow > 0
                ? Math.floor(roomsPerRow)
                : currentSettings.roomsPerRow
        }

        if (input.settings.interestRate !== undefined) {
            const interestRate = Number(input.settings.interestRate)
            currentSettings.interestRate = Number.isFinite(interestRate) && interestRate >= 0
                ? interestRate
                : currentSettings.interestRate
        }

        existing.settings = currentSettings
    }

    await existing.save()

    return {
        status: 'updated',
        building: mapBuildingDetail(existing.toObject() as LeanBuilding)
    }
}

export async function getBuildingDetailById(id: string, accountId?: string): Promise<BuildingDetailDto | null> {
    const objectId = requireObjectId(id)
    const accountObjectId = requireAccountObjectId(accountId)
    if (!objectId || !accountObjectId) return null

    const building = await Building.findOne({
        _id: objectId,
        accountId: accountObjectId
    }).lean<LeanBuilding | null>()
    if (!building) return null

    return mapBuildingDetail(building)
}

export async function getBuildingRoomsById(id: string, accountId?: string): Promise<BuildingRoomsDto | null> {
    const objectId = requireObjectId(id)
    const accountObjectId = requireAccountObjectId(accountId)
    if (!objectId || !accountObjectId) return null

    const building = await Building.findOne({
        _id: objectId,
        accountId: accountObjectId
    }).lean<LeanBuilding | null>()
    if (!building) return null

    const buildingId = building._id

    const [rooms, stays, invoices] = await Promise.all([
        Room.find({ buildingId }).lean<LeanRoom[]>(),
        Stay.find({ buildingId }).lean<LeanStay[]>(),
        Invoice.find({ buildingId }).lean<LeanInvoice[]>()
    ])

    const tenantIds = Array.from(
        new Set(stays.map((stay) => toObjectIdString(stay.tenantId)).filter(Boolean))
    )

    const tenants = tenantIds.length
        ? await Tenant.find({ _id: { $in: tenantIds } }).lean<LeanTenant[]>()
        : []

    const tenantById = new Map<string, LeanTenant>(
        tenants.map((tenant) => [toObjectIdString(tenant._id), tenant])
    )

    const staysByRoomId = new Map<string, LeanStay[]>()
    for (const stay of stays) {
        const key = toObjectIdString(stay.roomId)
        const existing = staysByRoomId.get(key) ?? []
        existing.push(stay)
        staysByRoomId.set(key, existing)
    }

    const invoicesByRoomId = new Map<string, LeanInvoice[]>()
    for (const invoice of invoices) {
        const key = toObjectIdString(invoice.roomId)
        const existing = invoicesByRoomId.get(key) ?? []
        existing.push(invoice)
        invoicesByRoomId.set(key, existing)
    }

    const roomDtos: BuildingRoomsRoomDto[] = rooms
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((room) => {
            const roomId = toObjectIdString(room._id)
            const roomStays = (staysByRoomId.get(roomId) ?? [])
                .slice()
                .sort((a, b) => compareDateDesc(a.rentalStartDate, b.rentalStartDate))

            const roomInvoices = (invoicesByRoomId.get(roomId) ?? [])
                .slice()
                .sort((a, b) => compareDateDesc(a.date, b.date))

            const currentStay = pickCurrentStay(roomStays, room.status)
            const currentTenant = currentStay
                ? tenantById.get(toObjectIdString(currentStay.tenantId))
                : undefined

            const latestInvoice = currentStay
                ? roomInvoices.find((invoice) => {
                      const invoiceTenantId = invoice.tenantId
                          ? toObjectIdString(invoice.tenantId)
                          : ''
                      const currentTenantId = toObjectIdString(currentStay.tenantId)

                      if (invoiceTenantId && invoiceTenantId === currentTenantId) return true

                      const invoiceTenantName = String(invoice.tenantNameSnapshot ?? '').trim()
                      const currentTenantName = String(currentTenant?.fullName ?? '').trim()

                      return !invoiceTenantId && !!currentTenantName && invoiceTenantName === currentTenantName
                  }) ?? null
                : null

            const overdue = computeRoomOverdue(roomInvoices, currentStay, currentTenant)
            const nextInvoiceDate = computeNextInvoiceDate(currentStay, latestInvoice)

            return {
                _id: roomId,
                buildingId: toObjectIdString(room.buildingId),
                name: room.name,
                roomType: room.roomType ?? 'standard',
                floor: room.floor ?? null,
                status: getEffectiveRoomStatus(room, currentStay),
                defaultRoomRate: room.defaultRoomRate ?? 0,
                notes: room.notes ?? '',
                isActive: room.isActive ?? true,
                currentStay: currentStay ? mapCurrentStayDto(currentStay, currentTenant) : null,
                latestInvoice: latestInvoice ? mapLatestInvoiceDto(latestInvoice) : null,
                overdue,
                nextInvoiceDate
            }
        })

    return {
        building: {
            _id: toObjectIdString(building._id),
            name: building.name,
            settings: toBuildingSettingsDto(building)
        },
        rooms: roomDtos
    }
}

export async function getBuildingPaymentsOverviewById(id: string, accountId?: string): Promise<PaymentsOverviewDto | null> {
    const objectId = requireObjectId(id)
    const accountObjectId = requireAccountObjectId(accountId)
    if (!objectId || !accountObjectId) return null

    const building = await Building.findOne({
        _id: objectId,
        accountId: accountObjectId
    }).lean<LeanBuilding | null>()
    if (!building) return null

    const buildingId = building._id

    const [rooms, stays, tenants, invoices, payments] = await Promise.all([
        Room.find({ buildingId }).lean<LeanRoom[]>(),
        Stay.find({ buildingId }).lean<LeanStay[]>(),
        Tenant.find({}).lean<LeanTenant[]>(),
        Invoice.find({ buildingId }).lean<LeanInvoice[]>(),
        Payment.find({ buildingId }).sort({ paymentDate: -1, createdAt: -1 }).lean<LeanPayment[]>()
    ])

    const tenantById = new Map<string, LeanTenant>(
        tenants.map((tenant) => [toObjectIdString(tenant._id), tenant])
    )

    const staysByRoomId = new Map<string, LeanStay[]>()
    for (const stay of stays) {
        const key = toObjectIdString(stay.roomId)
        const existing = staysByRoomId.get(key) ?? []
        existing.push(stay)
        staysByRoomId.set(key, existing)
    }

    const latestPaymentByInvoiceId = new Map<string, LeanPayment>()
    for (const payment of payments) {
        const invoiceId = toObjectIdString(payment.invoiceId)
        if (!latestPaymentByInvoiceId.has(invoiceId)) {
            latestPaymentByInvoiceId.set(invoiceId, payment)
        }
    }

    const roomById = new Map<string, LeanRoom>(
        rooms.map((room) => [toObjectIdString(room._id), room])
    )

    const roomDtos: PaymentsOverviewRoomDto[] = rooms
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((room) => {
            const roomId = toObjectIdString(room._id)
            const roomStays = (staysByRoomId.get(roomId) ?? [])
                .slice()
                .sort((a, b) => compareDateDesc(a.rentalStartDate, b.rentalStartDate))

            const currentStay = pickCurrentStay(roomStays, room.status)
            const currentTenant = currentStay
                ? tenantById.get(toObjectIdString(currentStay.tenantId))
                : undefined

            return {
                _id: roomId,
                buildingId: toObjectIdString(room.buildingId),
                name: room.name,
                roomType: room.roomType ?? 'standard',
                floor: room.floor ?? null,
                status: normalizeRoomStatus(room.status),
                defaultRoomRate: room.defaultRoomRate ?? 0,
                notes: room.notes ?? '',
                isActive: room.isActive ?? true,
                currentStay: currentStay ? mapCurrentStayDto(currentStay, currentTenant) : null
            }
        })

    const invoiceDtos: PaymentsOverviewInvoiceDto[] = invoices
        .slice()
        .sort((a, b) => {
            const roomA = roomById.get(toObjectIdString(a.roomId))?.name ?? ''
            const roomB = roomById.get(toObjectIdString(b.roomId))?.name ?? ''

            const roomCompare = roomA.localeCompare(roomB, undefined, { sensitivity: 'base' })
            if (roomCompare !== 0) return roomCompare

            return compareDateDesc(a.date, b.date)
        })
        .map((invoice) => {
            const room = roomById.get(toObjectIdString(invoice.roomId))

            if (!room) {
                return null
            }

            const payment = latestPaymentByInvoiceId.get(toObjectIdString(invoice._id)) ?? null

            return mapPaymentsOverviewInvoiceDto({
                invoice,
                room,
                payment
            })
        })
        .filter((invoice): invoice is PaymentsOverviewInvoiceDto => invoice !== null)

    return {
        building: {
            _id: toObjectIdString(building._id),
            name: building.name,
            settings: toBuildingSettingsDto(building)
        },
        rooms: roomDtos,
        invoices: invoiceDtos
    }
}

export async function getBuildingOccupancyById(id: string, accountId?: string): Promise<BuildingOccupancyDto | null> {
    const objectId = requireObjectId(id)
    const accountObjectId = requireAccountObjectId(accountId)
    if (!objectId || !accountObjectId) return null

    const building = await Building.findOne({
        _id: objectId,
        accountId: accountObjectId
    }).lean<LeanBuilding | null>()
    if (!building) return null

    const buildingId = building._id

    const [rooms, stays] = await Promise.all([
        Room.find({ buildingId }).lean<LeanRoom[]>(),
        Stay.find({ buildingId }).lean<LeanStay[]>()
    ])

    const tenantIds = Array.from(
        new Set(stays.map((stay) => toObjectIdString(stay.tenantId)).filter(Boolean))
    )

    const tenants = tenantIds.length
        ? await Tenant.find({ _id: { $in: tenantIds } }).lean<LeanTenant[]>()
        : []

    const tenantById = new Map<string, LeanTenant>(
        tenants.map((tenant) => [toObjectIdString(tenant._id), tenant])
    )

    const staysByRoomId = new Map<string, LeanStay[]>()
    for (const stay of stays) {
        const key = toObjectIdString(stay.roomId)
        const existing = staysByRoomId.get(key) ?? []
        existing.push(stay)
        staysByRoomId.set(key, existing)
    }

    const roomDtos: BuildingOccupancyRoomDto[] = rooms
        .slice()
        .sort((a, b) => {
            const floorCompare = (a.floor ?? 0) - (b.floor ?? 0)
            if (floorCompare !== 0) return floorCompare
            return a.name.localeCompare(b.name)
        })
        .map((room) => {
            const roomStays = staysByRoomId.get(toObjectIdString(room._id)) ?? []
            const currentStay = pickCurrentStay(roomStays, room.status)
            const tenant = currentStay
                ? tenantById.get(toObjectIdString(currentStay.tenantId))
                : undefined

            return {
                _id: toObjectIdString(room._id),
                name: room.name,
                floor: room.floor ?? null,
                roomType: room.roomType ?? 'standard',
                roomStatus: getEffectiveRoomStatus(room, currentStay),
                currentStay: currentStay ? mapOccupancyStayDto(currentStay, tenant) : null
            }
        })

    return {
        building: {
            _id: toObjectIdString(building._id),
            name: building.name
        },
        rooms: roomDtos
    }
}

export async function deleteBuildingCascade(id: string, accountId?: string): Promise<boolean> {
    const objectId = requireObjectId(id)
    const accountObjectId = requireAccountObjectId(accountId)
    if (!objectId || !accountObjectId) return false

    const building = await Building.findOne({
        _id: objectId,
        accountId: accountObjectId
    })
    if (!building) return false

    const buildingId = building._id

    await Promise.all([
        Room.deleteMany({ buildingId }),
        Stay.deleteMany({ buildingId }),
        Invoice.deleteMany({ buildingId }),
        Payment.deleteMany({ buildingId }),
        MeterReading.deleteMany({ buildingId }),
        Expense.deleteMany({ buildingId }),
        Service.deleteMany({ buildingId }),
        DocumentModel.deleteMany({ buildingId }),
        Building.deleteOne({ _id: buildingId })
    ])

    return true
}
