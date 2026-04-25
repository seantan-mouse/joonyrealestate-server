import { Types } from 'mongoose'
import dayjs, { Dayjs } from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import Building from '../../models/Building'
import Account from '../../models/Account'
import Expense from '../../models/Expense'
import Invoice from '../../models/Invoice'
import Payment from '../../models/Payment'
import Room from '../../models/Room'
import Stay from '../../models/Stay'
import Tenant from '../../models/Tenant'
import { getEffectiveStayStatus } from '../stay/stay.helpers'
import type {
    BuildingReportARAgingRowDto,
    BuildingReportExpenseRowDto,
    BuildingReportInvoiceRowDto,
    BuildingReportKpisDto,
    BuildingReportMonthlyRowDto,
    BuildingReportRoomRowDto,
    ReportInvoiceStatusFilter,
    ReportTenantTypeFilter
} from './report.types'
import type {
    GetPortfolioBookingPlanInput,
    GetPortfolioReportInput,
    PortfolioBookingPlanDto,
    PortfolioBookingPlanSegmentDto,
    PortfolioBookingPlanRowDto,
    PortfolioComparisonMetricDto,
    PortfolioExpenseScopeBreakdownDto,
    PortfolioInvoiceStatusBreakdownDto,
    PortfolioReportBuildingRowDto,
    PortfolioReportComparisonDto,
    PortfolioReportDto,
    PortfolioReportKpisDto,
    PortfolioReportRoomRowDto,
    PortfolioTenantTypeBreakdownDto
} from './portfolio.types'

dayjs.extend(customParseFormat)

type LeanBuilding = {
    _id: Types.ObjectId
    name: string
    settings?: {
        roomsPerRow?: number
        interestRate?: number
    }
}

type LeanRoom = {
    _id: Types.ObjectId
    accountId?: Types.ObjectId
    buildingId: Types.ObjectId
    name: string
    roomType?: string
    floor?: number | null
    status?: string
    blockedFrom?: string
    blockedTo?: string
    blockedRemarks?: string
    isActive?: boolean
}

type LeanStay = {
    _id: Types.ObjectId
    accountId?: Types.ObjectId
    ownerAccountId?: Types.ObjectId
    buildingId: Types.ObjectId
    roomId: Types.ObjectId
    tenantId: Types.ObjectId
    type?: string
    status?: string
    rentalStartDate?: string
    rentalEndDate?: string
    checkoutDate?: string
    cancelledAt?: string
    createdAt?: Date
}

type LeanTenant = {
    _id: Types.ObjectId
    fullName?: string
    phone?: string
    businessSource?: string
}

type LeanInvoice = {
    _id: Types.ObjectId
    buildingId: Types.ObjectId
    roomId: Types.ObjectId
    stayId?: Types.ObjectId | null
    tenantId?: Types.ObjectId | null
    invoiceNo: string
    date: string
    roomRate?: number
    nightlyRate?: number | null
    nights?: number | null
    totalAmount?: number
    outstandingAmount?: number
    status?: string
    tenantNameSnapshot?: string
}

type LeanAccount = {
    _id: Types.ObjectId
    slug?: string
    name?: string
    settings?: {
        bookingColor?: string
    }
}

type LeanPayment = {
    _id: Types.ObjectId
    invoiceId: Types.ObjectId
    paymentDate: string
    amount?: number
    type?: 'full' | 'partial'
    createdAt?: Date
}

type LeanExpense = {
    _id: Types.ObjectId
    buildingId: Types.ObjectId
    name?: string
    type?: string
    date: string
    amount?: number
    applyToRoomsType?: string
    selectedRoomIds?: Types.ObjectId[]
    notes?: string
}

type NormalizedInvoiceRow = BuildingReportInvoiceRowDto & {
    buildingId: string
    buildingName: string
    roomId: string
    invoiceDate: Dayjs
    statusBucket: ReportInvoiceStatusFilter
    tenantType: ReportTenantTypeFilter
}

type NormalizedExpenseRow = BuildingReportExpenseRowDto & {
    buildingId: string
    buildingName: string
    expenseDate: Dayjs
}

type NormalizedStay = {
    stayId: string
    buildingId: string
    buildingName: string
    roomId: string
    roomName: string
    tenantId: string
    tenantName: string
    tenantPhone: string
    status: 'reserved' | 'active' | 'checked_out' | 'cancelled'
    stayType: ReportTenantTypeFilter | 'daily'
    startDate: Dayjs
    endDate: Dayjs | null
}

type PortfolioBaseData = {
    buildings: Array<{ _id: string; name: string }>
    rooms: Array<{
        _id: string
        buildingId: string
        buildingName: string
        name: string
        roomType: string
        floor: number | null
        status: string
        isActive: boolean
    }>
    invoices: NormalizedInvoiceRow[]
    expenses: NormalizedExpenseRow[]
    stays: NormalizedStay[]
}

type RangeSummary = {
    kpis: PortfolioReportKpisDto
    invoiceRows: Array<
        BuildingReportInvoiceRowDto & {
            buildingId: string
            buildingName: string
        }
    >
    expenseRows: Array<
        BuildingReportExpenseRowDto & {
            buildingId: string
            buildingName: string
        }
    >
    monthly: BuildingReportMonthlyRowDto[]
    arAging: BuildingReportARAgingRowDto[]
    buildingSummary: PortfolioReportBuildingRowDto[]
    roomSummary: PortfolioReportRoomRowDto[]
    topOutstandingInvoices: Array<
        BuildingReportInvoiceRowDto & {
            buildingId: string
            buildingName: string
        }
    >
    recentExpenses: Array<
        BuildingReportExpenseRowDto & {
            buildingId: string
            buildingName: string
        }
    >
    financeBreakdown: {
        invoiceStatus: PortfolioInvoiceStatusBreakdownDto[]
        expenseScope: PortfolioExpenseScopeBreakdownDto[]
        tenantType: PortfolioTenantTypeBreakdownDto[]
    }
}

function toObjectIdString(value: Types.ObjectId | string | null | undefined): string {
    if (value instanceof Types.ObjectId) return value.toString()
    return String(value ?? '')
}

function toNumber(value: unknown, fallback = 0): number {
    const num = Number(value)
    return Number.isFinite(num) ? num : fallback
}

function parseStoredDate(value?: string): Dayjs | null {
    const raw = String(value ?? '').trim()
    if (!raw) return null

    const candidates = [
        'D MMM YYYY',
        'DD MMM YYYY',
        'YYYY-MM-DD',
        'YYYY/MM/DD',
        'D/M/YYYY',
        'DD/MM/YYYY',
        'YYYY-MM'
    ]

    for (const format of candidates) {
        const parsed = dayjs(raw, format, true)
        if (parsed.isValid()) return parsed.startOf('day')
    }

    const parsed = dayjs(raw)
    return parsed.isValid() ? parsed.startOf('day') : null
}

function inRangeInclusive(date: Dayjs, start: Dayjs, end: Dayjs): boolean {
    const startOfDay = start.startOf('day')
    const endOfDay = end.endOf('day')
    return (
        (date.isAfter(startOfDay) || date.isSame(startOfDay)) &&
        (date.isBefore(endOfDay) || date.isSame(endOfDay))
    )
}

function daysBetween(start: Dayjs, end: Dayjs): number {
    return Math.max(0, end.startOf('day').diff(start.startOf('day'), 'day'))
}

function monthKey(date: Dayjs): string {
    return date.format('YYYY-MM')
}

function normalizeTenantType(value?: string): ReportTenantTypeFilter | 'daily' {
    if (value === 'contract') return 'contract'
    if (value === 'daily') return 'daily'
    return 'monthly'
}

function deriveInvoiceStatusBucket(args: {
    rawStatus?: string
    outstanding: number
    invoiceDate: Dayjs
}): ReportInvoiceStatusFilter {
    const status = String(args.rawStatus ?? '').trim().toLowerCase()

    if (status === 'paid') return 'Paid'
    if (status === 'partially paid' || status === 'partial') return 'Partial'

    if (args.outstanding > 0 && args.invoiceDate.isBefore(dayjs().startOf('day'), 'day')) {
        return 'Overdue'
    }

    return 'New'
}

function getStayStartDate(stay: NormalizedStay): Dayjs {
    return stay.startDate
}

function getStayEndDate(stay: NormalizedStay, rangeEnd: Dayjs): Dayjs {
    return stay.endDate ?? rangeEnd
}

function getOverlapDays(args: {
    stay: NormalizedStay
    rangeStart: Dayjs
    rangeEnd: Dayjs
}): number {
    const { stay, rangeStart, rangeEnd } = args

    const stayStart = getStayStartDate(stay)
    const stayEnd = getStayEndDate(stay, rangeEnd)

    const overlapStart = stayStart.isAfter(rangeStart) ? stayStart : rangeStart
    const overlapEnd = stayEnd.isBefore(rangeEnd) ? stayEnd : rangeEnd

    if (overlapEnd.isBefore(overlapStart, 'day')) return 0

    return daysBetween(overlapStart, overlapEnd) + 1
}

function isSelectedExpenseScope(value?: string): boolean {
    const raw = String(value ?? '').trim().toLowerCase()
    return raw.includes('selected')
}

function isAllExpenseScope(value?: string): boolean {
    const raw = String(value ?? '').trim().toLowerCase()
    return raw.includes('all')
}

function compareDateDesc(left?: string, right?: string): number {
    return String(right ?? '').localeCompare(String(left ?? ''))
}

function toComparisonMetric(current: number, previous: number): PortfolioComparisonMetricDto {
    const delta = current - previous
    return {
        current,
        previous,
        delta,
        deltaPct: previous === 0 ? null : (delta / previous) * 100
    }
}

function buildComparison(current: PortfolioReportKpisDto, previous: PortfolioReportKpisDto): PortfolioReportComparisonDto {
    return {
        revenuePaid: toComparisonMetric(current.revenuePaid, previous.revenuePaid),
        revenueAccrued: toComparisonMetric(current.revenueAccrued, previous.revenueAccrued),
        cashCollected: toComparisonMetric(current.cashCollected, previous.cashCollected),
        arOutstanding: toComparisonMetric(current.arOutstanding, previous.arOutstanding),
        expenses: toComparisonMetric(current.expenses, previous.expenses),
        profitPaidBasis: toComparisonMetric(current.profitPaidBasis, previous.profitPaidBasis),
        profitAccrualBasis: toComparisonMetric(current.profitAccrualBasis, previous.profitAccrualBasis),
        occupancyRate: toComparisonMetric(current.occupancyRate, previous.occupancyRate),
        revpar: toComparisonMetric(current.revpar, previous.revpar),
        adr: toComparisonMetric(current.adr, previous.adr)
    }
}

async function loadPortfolioBaseData(scopedBuildingIds: string[]): Promise<PortfolioBaseData> {
    const objectIds = scopedBuildingIds
        .filter((id) => Types.ObjectId.isValid(id))
        .map((id) => new Types.ObjectId(id))

    if (objectIds.length === 0) {
        return {
            buildings: [],
            rooms: [],
            invoices: [],
            expenses: [],
            stays: []
        }
    }

    const [buildings, rooms, stays, invoices, payments, expenses] = await Promise.all([
        Building.find({ _id: { $in: objectIds } })
            .select('_id name settings')
            .lean<LeanBuilding[]>(),
        Room.find({ buildingId: { $in: objectIds } })
            .select('_id buildingId name roomType floor status isActive')
            .lean<LeanRoom[]>(),
        Stay.find({ buildingId: { $in: objectIds } })
            .select('_id buildingId roomId tenantId type status rentalStartDate rentalEndDate checkoutDate cancelledAt createdAt')
            .lean<LeanStay[]>(),
        Invoice.find({ buildingId: { $in: objectIds } })
            .select('_id buildingId roomId stayId tenantId invoiceNo date roomRate nightlyRate nights totalAmount outstandingAmount status tenantNameSnapshot')
            .lean<LeanInvoice[]>(),
        Payment.find({ buildingId: { $in: objectIds } })
            .select('_id invoiceId paymentDate amount type createdAt')
            .lean<LeanPayment[]>(),
        Expense.find({ buildingId: { $in: objectIds } })
            .select('_id buildingId name type date amount applyToRoomsType selectedRoomIds notes')
            .lean<LeanExpense[]>()
    ])

    const tenantObjectIds = Array.from(
        new Set(
            stays
                .map((stay) => toObjectIdString(stay.tenantId))
                .filter((id) => Types.ObjectId.isValid(id))
        )
    ).map((id) => new Types.ObjectId(id))

    const tenants = tenantObjectIds.length > 0
        ? await Tenant.find({ _id: { $in: tenantObjectIds } })
            .select('_id fullName phone')
            .lean<LeanTenant[]>()
        : []

    const buildingById = new Map<string, LeanBuilding>(
        buildings.map((building) => [toObjectIdString(building._id), building])
    )
    const tenantById = new Map<string, LeanTenant>(
        tenants.map((tenant) => [toObjectIdString(tenant._id), tenant])
    )
    const roomById = new Map<string, LeanRoom>(
        rooms.map((room) => [toObjectIdString(room._id), room])
    )
    const roomNameById = new Map<string, string>(
        rooms.map((room) => [toObjectIdString(room._id), room.name])
    )
    const stayById = new Map<string, LeanStay>(
        stays.map((stay) => [toObjectIdString(stay._id), stay])
    )

    const paymentsByInvoiceId = new Map<string, LeanPayment[]>()

    for (const payment of payments) {
        const key = toObjectIdString(payment.invoiceId)
        const existing = paymentsByInvoiceId.get(key) ?? []
        existing.push(payment)
        paymentsByInvoiceId.set(key, existing)
    }

    for (const group of paymentsByInvoiceId.values()) {
        group.sort((left, right) => {
            const paymentDateCompare = compareDateDesc(left.paymentDate, right.paymentDate)
            if (paymentDateCompare !== 0) return paymentDateCompare

            const leftCreatedAt = left.createdAt ? left.createdAt.getTime() : 0
            const rightCreatedAt = right.createdAt ? right.createdAt.getTime() : 0
            return rightCreatedAt - leftCreatedAt
        })
    }

    const normalizedInvoices: NormalizedInvoiceRow[] = invoices
        .map((invoice) => {
            if (String(invoice.status ?? '').trim().toLowerCase() === 'voided') {
                return null
            }

            const buildingId = toObjectIdString(invoice.buildingId)
            const roomId = toObjectIdString(invoice.roomId)
            const buildingName = buildingById.get(buildingId)?.name ?? ''
            const roomName = roomNameById.get(roomId) ?? ''
            const invoiceDate = parseStoredDate(invoice.date)

            if (!invoiceDate || !roomName || !buildingName) {
                return null
            }

            const invoicePayments = paymentsByInvoiceId.get(toObjectIdString(invoice._id)) ?? []
            const paidAmount = invoicePayments.reduce((sum, payment) => sum + toNumber(payment.amount, 0), 0)
            const total = toNumber(invoice.totalAmount, 0)
            const explicitOutstanding = toNumber(invoice.outstandingAmount, 0)
            const outstanding = explicitOutstanding > 0
                ? explicitOutstanding
                : Math.max(0, total - paidAmount)

            const linkedStay = stayById.get(toObjectIdString(invoice.stayId ?? null))
            const tenantType = (() => {
                if (linkedStay?.type) {
                    const normalized = normalizeTenantType(linkedStay.type)
                    return normalized === 'daily' ? 'monthly' : normalized
                }

                if (toNumber(invoice.nightlyRate, 0) > 0 && toNumber(invoice.nights, 0) > 0) {
                    return 'contract'
                }

                return 'monthly'
            })()

            return {
                _id: toObjectIdString(invoice._id),
                buildingId,
                buildingName,
                roomId,
                invoiceNo: invoice.invoiceNo,
                date: invoice.date,
                roomName,
                tenantName: String(invoice.tenantNameSnapshot ?? '').trim(),
                status: String(invoice.status ?? 'Not paid'),
                total,
                paidAmount,
                outstanding,
                isContract: tenantType === 'contract',
                nightlyRate: invoice.nightlyRate ?? null,
                nights: invoice.nights ?? null,
                invoiceDate,
                statusBucket: deriveInvoiceStatusBucket({
                    rawStatus: invoice.status,
                    outstanding,
                    invoiceDate
                }),
                tenantType
            }
        })
        .filter((row): row is NormalizedInvoiceRow => row !== null)

    const normalizedExpenses: NormalizedExpenseRow[] = expenses
        .map((expense) => {
            const buildingId = toObjectIdString(expense.buildingId)
            const buildingName = buildingById.get(buildingId)?.name ?? ''
            const expenseDate = parseStoredDate(expense.date)

            if (!expenseDate || !buildingName) return null

            const selectedRooms = Array.isArray(expense.selectedRoomIds)
                ? expense.selectedRoomIds
                      .map((roomId) => roomNameById.get(toObjectIdString(roomId)) ?? '')
                      .filter(Boolean)
                : []

            const scope: 'all' | 'selected' | 'unknown' =
                isAllExpenseScope(expense.applyToRoomsType)
                    ? 'all'
                    : isSelectedExpenseScope(expense.applyToRoomsType)
                        ? 'selected'
                        : 'unknown'

            return {
                _id: toObjectIdString(expense._id),
                buildingId,
                buildingName,
                date: expense.date,
                name: String(expense.name ?? ''),
                type: String(expense.type ?? 'general'),
                amount: toNumber(expense.amount, 0),
                scope,
                selectedRooms,
                notes: String(expense.notes ?? ''),
                expenseDate
            }
        })
        .filter((row): row is NormalizedExpenseRow => row !== null)

    const normalizedStays: NormalizedStay[] = stays
        .map((stay) => {
            const buildingId = toObjectIdString(stay.buildingId)
            const roomId = toObjectIdString(stay.roomId)
            const tenantId = toObjectIdString(stay.tenantId)
            const buildingName = buildingById.get(buildingId)?.name ?? ''
            const roomName = roomById.get(roomId)?.name ?? ''
            const tenant = tenantById.get(tenantId)
            const startDate = parseStoredDate(stay.rentalStartDate)

            if (!buildingName || !roomName || !startDate) {
                return null
            }

            const checkoutDate = parseStoredDate(stay.checkoutDate)
            const rentalEndDate = parseStoredDate(stay.rentalEndDate)
            const cancelledAt = parseStoredDate(stay.cancelledAt)
            const explicitEnd = checkoutDate ?? rentalEndDate ?? cancelledAt ?? null

            return {
                stayId: toObjectIdString(stay._id),
                buildingId,
                buildingName,
                roomId,
                roomName,
                tenantId,
                tenantName: String(tenant?.fullName ?? '').trim(),
                tenantPhone: String(tenant?.phone ?? '').trim(),
                status: getEffectiveStayStatus(stay),
                stayType: normalizeTenantType(stay.type),
                startDate,
                endDate: explicitEnd
            }
        })
        .filter((stay): stay is NormalizedStay => stay !== null)

    return {
        buildings: buildings
            .map((building) => ({ _id: toObjectIdString(building._id), name: building.name }))
            .sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })),
        rooms: rooms
            .map((room) => ({
                _id: toObjectIdString(room._id),
                buildingId: toObjectIdString(room.buildingId),
                buildingName: buildingById.get(toObjectIdString(room.buildingId))?.name ?? '',
                name: room.name,
                roomType: String(room.roomType ?? 'standard'),
                floor: room.floor ?? null,
                status: String(room.status ?? 'Vacant'),
                isActive: room.isActive ?? true
            }))
            .sort((left, right) => {
                const buildingCompare = left.buildingName.localeCompare(right.buildingName, undefined, { sensitivity: 'base' })
                if (buildingCompare !== 0) return buildingCompare

                const floorLeft = left.floor ?? 9999
                const floorRight = right.floor ?? 9999
                if (floorLeft !== floorRight) return floorLeft - floorRight

                return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })
            }),
        invoices: normalizedInvoices,
        expenses: normalizedExpenses,
        stays: normalizedStays
    }
}

function summarizeRange(args: {
    data: PortfolioBaseData
    rangeStart: Dayjs
    rangeEnd: Dayjs
    statuses: ReportInvoiceStatusFilter[]
    tenantTypes: ReportTenantTypeFilter[]
    includeRows?: boolean
}): RangeSummary {
    const { data, rangeStart, rangeEnd, statuses, tenantTypes, includeRows = false } = args
    const totalDays = daysBetween(rangeStart, rangeEnd) + 1
    const statusSet = new Set(statuses)
    const hasStatusFilter = statusSet.size > 0
    const tenantTypeSet = new Set(tenantTypes)
    const hasTenantTypeFilter = tenantTypeSet.size > 0

    const filteredInvoices = data.invoices.filter((invoice) => {
        if (!inRangeInclusive(invoice.invoiceDate, rangeStart, rangeEnd)) return false
        if (hasStatusFilter && !statusSet.has(invoice.statusBucket)) return false
        if (hasTenantTypeFilter && !tenantTypeSet.has(invoice.tenantType)) return false
        return true
    })

    const filteredExpenses = data.expenses.filter((expense) => {
        return inRangeInclusive(expense.expenseDate, rangeStart, rangeEnd)
    })

    const filteredStays = data.stays.filter((stay) => {
        if (hasTenantTypeFilter) {
            if (stay.stayType === 'daily') {
                return false
            }

            if (!tenantTypeSet.has(stay.stayType)) {
                return false
            }
        }

        return true
    })

    const totalRoomDays = Math.max(1, totalDays * Math.max(1, data.rooms.length))
    const occupiedRoomDays = filteredStays.reduce((sum, stay) => {
        return sum + getOverlapDays({
            stay,
            rangeStart,
            rangeEnd
        })
    }, 0)

    const revenuePaid = filteredInvoices
        .filter((invoice) => invoice.statusBucket === 'Paid')
        .reduce((sum, invoice) => sum + invoice.total, 0)
    const revenueAccrued = filteredInvoices.reduce((sum, invoice) => sum + invoice.total, 0)
    const cashCollected = filteredInvoices.reduce((sum, invoice) => sum + invoice.paidAmount, 0)
    const arOutstanding = filteredInvoices.reduce((sum, invoice) => sum + invoice.outstanding, 0)
    const expensesTotal = filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0)
    const occupancyRate = Math.min(1, occupiedRoomDays / totalRoomDays)
    const revpar = revenuePaid / totalRoomDays
    const adr = occupiedRoomDays > 0 ? revenuePaid / occupiedRoomDays : 0

    const kpis: PortfolioReportKpisDto = {
        revenuePaid,
        revenueAccrued,
        cashCollected,
        arOutstanding,
        expenses: expensesTotal,
        profitPaidBasis: revenuePaid - expensesTotal,
        profitAccrualBasis: revenueAccrued - expensesTotal,
        occupancyRate,
        revpar,
        adr,
        buildingCount: data.buildings.length,
        roomCount: data.rooms.length,
        invoiceCount: filteredInvoices.length,
        outstandingInvoiceCount: filteredInvoices.filter((invoice) => invoice.outstanding > 0).length,
        expenseCount: filteredExpenses.length
    }

    const monthlyKeys = new Set<string>()
    filteredInvoices.forEach((invoice) => monthlyKeys.add(monthKey(invoice.invoiceDate)))
    filteredExpenses.forEach((expense) => monthlyKeys.add(monthKey(expense.expenseDate)))

    const invoiceRows = includeRows
        ? filteredInvoices
            .slice()
            .sort((left, right) => {
                const dateDiff = right.invoiceDate.valueOf() - left.invoiceDate.valueOf()
                if (dateDiff !== 0) return dateDiff
                return right.outstanding - left.outstanding
            })
            .map((invoice) => ({
                _id: invoice._id,
                buildingId: invoice.buildingId,
                buildingName: invoice.buildingName,
                invoiceNo: invoice.invoiceNo,
                date: invoice.date,
                roomName: invoice.roomName,
                tenantName: invoice.tenantName,
                status: invoice.status,
                total: invoice.total,
                paidAmount: invoice.paidAmount,
                outstanding: invoice.outstanding,
                isContract: invoice.isContract,
                nightlyRate: invoice.nightlyRate,
                nights: invoice.nights
            }))
        : []

    const expenseRows = includeRows
        ? filteredExpenses
            .slice()
            .sort((left, right) => right.expenseDate.valueOf() - left.expenseDate.valueOf())
            .map((expense) => ({
                _id: expense._id,
                buildingId: expense.buildingId,
                buildingName: expense.buildingName,
                date: expense.date,
                name: expense.name,
                type: expense.type,
                amount: expense.amount,
                scope: expense.scope,
                selectedRooms: expense.selectedRooms,
                notes: expense.notes
            }))
        : []

    const monthly: BuildingReportMonthlyRowDto[] = Array.from(monthlyKeys)
        .sort()
        .map((month) => {
            const monthInvoices = filteredInvoices.filter((invoice) => monthKey(invoice.invoiceDate) === month)
            const monthExpenses = filteredExpenses.filter((expense) => monthKey(expense.expenseDate) === month)

            return {
                month,
                revenuePaid: monthInvoices
                    .filter((invoice) => invoice.statusBucket === 'Paid')
                    .reduce((sum, invoice) => sum + invoice.total, 0),
                revenueAccrued: monthInvoices.reduce((sum, invoice) => sum + invoice.total, 0),
                cashCollected: monthInvoices.reduce((sum, invoice) => sum + invoice.paidAmount, 0),
                expenses: monthExpenses.reduce((sum, expense) => sum + expense.amount, 0)
            }
        })

    const arAgingBuckets = [
        { label: '0–7 days', min: 0, max: 7 },
        { label: '8–30 days', min: 8, max: 30 },
        { label: '31–60 days', min: 31, max: 60 },
        { label: '61+ days', min: 61, max: 100000 }
    ]

    const arAging: BuildingReportARAgingRowDto[] = arAgingBuckets.map((bucket) => {
        const inBucket = filteredInvoices.filter((invoice) => {
            if (invoice.outstanding <= 0) return false
            const age = Math.max(0, rangeEnd.startOf('day').diff(invoice.invoiceDate.startOf('day'), 'day'))
            return age >= bucket.min && age <= bucket.max
        })

        return {
            label: bucket.label,
            amount: inBucket.reduce((sum, invoice) => sum + invoice.outstanding, 0),
            count: inBucket.length
        }
    })

    const expensesByBuilding = new Map<string, NormalizedExpenseRow[]>(
        data.buildings.map((building) => [
            building._id,
            filteredExpenses.filter((expense) => expense.buildingId === building._id)
        ])
    )
    const invoicesByBuilding = new Map<string, NormalizedInvoiceRow[]>(
        data.buildings.map((building) => [
            building._id,
            filteredInvoices.filter((invoice) => invoice.buildingId === building._id)
        ])
    )
    const staysByBuilding = new Map<string, NormalizedStay[]>(
        data.buildings.map((building) => [
            building._id,
            filteredStays.filter((stay) => stay.buildingId === building._id)
        ])
    )

    const buildingSummary: PortfolioReportBuildingRowDto[] = data.buildings
        .map((building) => {
            const buildingRooms = data.rooms.filter((room) => room.buildingId === building._id)
            const buildingInvoices = invoicesByBuilding.get(building._id) ?? []
            const buildingExpenses = expensesByBuilding.get(building._id) ?? []
            const buildingStays = staysByBuilding.get(building._id) ?? []

            const buildingRoomDays = Math.max(1, totalDays * Math.max(1, buildingRooms.length))
            const buildingOccupiedDays = buildingStays.reduce((sum, stay) => {
                return sum + getOverlapDays({ stay, rangeStart, rangeEnd })
            }, 0)

            const buildingRevenuePaid = buildingInvoices
                .filter((invoice) => invoice.statusBucket === 'Paid')
                .reduce((sum, invoice) => sum + invoice.total, 0)
            const buildingExpensesTotal = buildingExpenses.reduce((sum, expense) => sum + expense.amount, 0)

            return {
                buildingId: building._id,
                buildingName: building.name,
                roomCount: buildingRooms.length,
                invoiceCount: buildingInvoices.length,
                expenseCount: buildingExpenses.length,
                revenuePaid: buildingRevenuePaid,
                revenueAccrued: buildingInvoices.reduce((sum, invoice) => sum + invoice.total, 0),
                cashCollected: buildingInvoices.reduce((sum, invoice) => sum + invoice.paidAmount, 0),
                arOutstanding: buildingInvoices.reduce((sum, invoice) => sum + invoice.outstanding, 0),
                expenses: buildingExpensesTotal,
                profitPaidBasis: buildingRevenuePaid - buildingExpensesTotal,
                occupancyRate: Math.min(1, buildingOccupiedDays / buildingRoomDays),
                revpar: buildingRevenuePaid / buildingRoomDays,
                adr: buildingOccupiedDays > 0 ? buildingRevenuePaid / buildingOccupiedDays : 0
            }
        })
        .sort((left, right) => right.profitPaidBasis - left.profitPaidBasis)

    const roomSummary: PortfolioReportRoomRowDto[] = data.rooms
        .map((room) => {
            const roomInvoices = filteredInvoices.filter((invoice) => invoice.roomId === room._id)
            const roomStays = filteredStays.filter((stay) => stay.roomId === room._id)
            const buildingExpenses = expensesByBuilding.get(room.buildingId) ?? []
            const buildingRoomCount = Math.max(1, data.rooms.filter((candidate) => candidate.buildingId === room.buildingId).length)
            const allScopePerRoom = buildingExpenses
                .filter((expense) => expense.scope === 'all')
                .reduce((sum, expense) => sum + expense.amount, 0) / buildingRoomCount
            const selectedAllocated = buildingExpenses
                .filter((expense) => expense.scope === 'selected' && expense.selectedRooms.includes(room.name))
                .reduce((sum, expense) => sum + (expense.amount / Math.max(1, expense.selectedRooms.length)), 0)

            const roomOccupiedDays = roomStays.reduce((sum, stay) => {
                return sum + getOverlapDays({ stay, rangeStart, rangeEnd })
            }, 0)
            const revenuePaidForRoom = roomInvoices
                .filter((invoice) => invoice.statusBucket === 'Paid')
                .reduce((sum, invoice) => sum + invoice.total, 0)
            const expensesAllocated = allScopePerRoom + selectedAllocated

            return {
                buildingId: room.buildingId,
                buildingName: room.buildingName,
                room: room.name,
                revenuePaid: revenuePaidForRoom,
                revenueAccrued: roomInvoices.reduce((sum, invoice) => sum + invoice.total, 0),
                cashCollected: roomInvoices.reduce((sum, invoice) => sum + invoice.paidAmount, 0),
                arOutstanding: roomInvoices.reduce((sum, invoice) => sum + invoice.outstanding, 0),
                expensesAllocated,
                profitPaidBasis: revenuePaidForRoom - expensesAllocated,
                occupancyRate: Math.min(1, roomOccupiedDays / Math.max(1, totalDays))
            }
        })
        .sort((left, right) => right.profitPaidBasis - left.profitPaidBasis)

    const topOutstandingInvoices = filteredInvoices
        .filter((invoice) => invoice.outstanding > 0)
        .sort((left, right) => {
            if (right.outstanding !== left.outstanding) return right.outstanding - left.outstanding
            return right.invoiceDate.valueOf() - left.invoiceDate.valueOf()
        })
        .slice(0, 12)
        .map((invoice) => ({
            _id: invoice._id,
            buildingId: invoice.buildingId,
            buildingName: invoice.buildingName,
            invoiceNo: invoice.invoiceNo,
            date: invoice.date,
            roomName: invoice.roomName,
            tenantName: invoice.tenantName,
            status: invoice.status,
            total: invoice.total,
            paidAmount: invoice.paidAmount,
            outstanding: invoice.outstanding,
            isContract: invoice.isContract,
            nightlyRate: invoice.nightlyRate,
            nights: invoice.nights
        }))

    const recentExpenses = filteredExpenses
        .slice()
        .sort((left, right) => right.expenseDate.valueOf() - left.expenseDate.valueOf())
        .slice(0, 12)
        .map((expense) => ({
            _id: expense._id,
            buildingId: expense.buildingId,
            buildingName: expense.buildingName,
            date: expense.date,
            name: expense.name,
            type: expense.type,
            amount: expense.amount,
            scope: expense.scope,
            selectedRooms: expense.selectedRooms,
            notes: expense.notes
        }))

    const invoiceStatusBuckets: ReportInvoiceStatusFilter[] = ['Paid', 'Partial', 'New', 'Overdue']
    const invoiceStatus: PortfolioInvoiceStatusBreakdownDto[] = invoiceStatusBuckets.map((bucket) => {
        const bucketInvoices = filteredInvoices.filter((invoice) => invoice.statusBucket === bucket)
        return {
            bucket,
            count: bucketInvoices.length,
            total: bucketInvoices.reduce((sum, invoice) => sum + invoice.total, 0),
            paidAmount: bucketInvoices.reduce((sum, invoice) => sum + invoice.paidAmount, 0),
            outstanding: bucketInvoices.reduce((sum, invoice) => sum + invoice.outstanding, 0)
        }
    })

    const expenseScopes: Array<PortfolioExpenseScopeBreakdownDto['scope']> = ['all', 'selected', 'unknown']
    const expenseScope: PortfolioExpenseScopeBreakdownDto[] = expenseScopes.map((scope) => {
        const scopeExpenses = filteredExpenses.filter((expense) => expense.scope === scope)
        return {
            scope,
            count: scopeExpenses.length,
            amount: scopeExpenses.reduce((sum, expense) => sum + expense.amount, 0)
        }
    })

    const tenantTypeFilters: ReportTenantTypeFilter[] = ['monthly', 'contract']
    const tenantType: PortfolioTenantTypeBreakdownDto[] = tenantTypeFilters.map((type) => {
        const typeInvoices = filteredInvoices.filter((invoice) => invoice.tenantType === type)
        return {
            tenantType: type,
            invoiceCount: typeInvoices.length,
            revenuePaid: typeInvoices
                .filter((invoice) => invoice.statusBucket === 'Paid')
                .reduce((sum, invoice) => sum + invoice.total, 0),
            revenueAccrued: typeInvoices.reduce((sum, invoice) => sum + invoice.total, 0),
            outstanding: typeInvoices.reduce((sum, invoice) => sum + invoice.outstanding, 0)
        }
    })

    return {
        kpis,
        invoiceRows,
        expenseRows,
        monthly,
        arAging,
        buildingSummary,
        roomSummary,
        topOutstandingInvoices,
        recentExpenses,
        financeBreakdown: {
            invoiceStatus,
            expenseScope,
            tenantType
        }
    }
}

export async function getPortfolioReport(input: GetPortfolioReportInput): Promise<Omit<PortfolioReportDto, 'availableBuildings'>> {
    const rangeStart = parseStoredDate(input.start)
    const rangeEnd = parseStoredDate(input.end)

    if (!rangeStart || !rangeEnd) {
        throw new Error('Invalid date range')
    }

    const data = await loadPortfolioBaseData(input.scopedBuildingIds)
    const current = summarizeRange({
        data,
        rangeStart,
        rangeEnd,
        statuses: input.statuses,
        tenantTypes: input.tenantTypes,
        includeRows: input.includeRows
    })

    const rangeLength = daysBetween(rangeStart, rangeEnd) + 1
    const comparisonEnd = rangeStart.subtract(1, 'day')
    const comparisonStart = comparisonEnd.subtract(rangeLength - 1, 'day')

    const previous = summarizeRange({
        data,
        rangeStart: comparisonStart,
        rangeEnd: comparisonEnd,
        statuses: input.statuses,
        tenantTypes: input.tenantTypes
    })

    return {
        scope: {
            buildingIds: data.buildings.map((building) => building._id),
            start: rangeStart.format('YYYY-MM-DD'),
            end: rangeEnd.format('YYYY-MM-DD'),
            comparisonStart: comparisonStart.format('YYYY-MM-DD'),
            comparisonEnd: comparisonEnd.format('YYYY-MM-DD')
        },
        kpis: current.kpis,
        comparison: buildComparison(current.kpis, previous.kpis),
        invoiceRows: current.invoiceRows,
        expenseRows: current.expenseRows,
        monthly: current.monthly,
        arAging: current.arAging,
        buildingSummary: current.buildingSummary,
        roomSummary: current.roomSummary,
        topOutstandingInvoices: current.topOutstandingInvoices,
        recentExpenses: current.recentExpenses,
        financeBreakdown: current.financeBreakdown
    }
}

export async function getPortfolioBookingPlan(input: GetPortfolioBookingPlanInput): Promise<Omit<PortfolioBookingPlanDto, 'availableBuildings'>> {
    let rangeStart: Dayjs | null = null
    let rangeEnd: Dayjs | null = null
    let monthLabel = ''
    let isRange = false

    if (input.month) {
        const month = parseStoredDate(input.month)
        if (!month) {
            throw new Error('Invalid month')
        }

        rangeStart = month.startOf('month')
        rangeEnd = month.endOf('month')
        monthLabel = rangeStart.format('YYYY-MM')
    } else {
        const parsedStart = parseStoredDate(input.start)
        const parsedEnd = parseStoredDate(input.end)

        if (!parsedStart || !parsedEnd) {
            throw new Error('Invalid booking plan range')
        }

        rangeStart = parsedStart.startOf('day')
        rangeEnd = parsedEnd.endOf('day')

        if (rangeEnd.isBefore(rangeStart, 'day')) {
            const originalStart = rangeStart
            rangeStart = rangeEnd.startOf('day')
            rangeEnd = originalStart.endOf('day')
        }

        monthLabel = rangeStart.format('YYYY-MM')
        isRange = true
    }

    if (!rangeStart || !rangeEnd) {
        throw new Error('Invalid booking plan scope')
    }

    const objectIds = input.scopedBuildingIds
        .filter((id) => Types.ObjectId.isValid(id))
        .map((id) => new Types.ObjectId(id))

    const [buildings, rooms, stays, tenants, invoices, accounts] = await Promise.all([
        Building.find({ _id: { $in: objectIds } }).lean<LeanBuilding[]>(),
        Room.find({ buildingId: { $in: objectIds } }).lean<LeanRoom[]>(),
        Stay.find({ buildingId: { $in: objectIds } }).lean<LeanStay[]>(),
        Tenant.find({}).lean<LeanTenant[]>(),
        Invoice.find({ buildingId: { $in: objectIds } })
            .select('_id stayId tenantId totalAmount outstandingAmount status')
            .lean<Array<Pick<LeanInvoice, '_id' | 'stayId' | 'tenantId' | 'totalAmount' | 'outstandingAmount' | 'status'>>>(),
        Account.find({ status: 'active' })
            .select('_id slug name settings')
            .lean<LeanAccount[]>()
    ])

    const buildingById = new Map<string, LeanBuilding>(
        buildings.map((building) => [toObjectIdString(building._id), building])
    )
    const tenantById = new Map<string, LeanTenant>(
        tenants.map((tenant) => [toObjectIdString(tenant._id), tenant])
    )
    const accountById = new Map<string, LeanAccount>(
        accounts.map((account) => [toObjectIdString(account._id), account])
    )
    const unpaidByStayId = new Map<string, boolean>()
    const invoiceCountByStayId = new Map<string, number>()

    for (const invoice of invoices) {
        if (String(invoice.status ?? '').trim().toLowerCase() === 'voided') continue

        const stayId = toObjectIdString(invoice.stayId ?? null)
        if (!stayId) continue

        invoiceCountByStayId.set(stayId, (invoiceCountByStayId.get(stayId) ?? 0) + 1)

        const outstanding = toNumber(invoice.outstandingAmount, 0) > 0
            ? toNumber(invoice.outstandingAmount, 0)
            : Math.max(0, toNumber(invoice.totalAmount, 0))

        if (outstanding > 0 && String(invoice.status ?? '').trim().toLowerCase() !== 'paid') {
            unpaidByStayId.set(stayId, true)
        }
    }

    const roomRows: PortfolioBookingPlanRowDto[] = rooms
        .map((room) => {
            const buildingId = toObjectIdString(room.buildingId)
            const buildingName = buildingById.get(buildingId)?.name ?? ''
            const roomId = toObjectIdString(room._id)

            const segments: PortfolioBookingPlanSegmentDto[] = stays
                .filter((stay) => toObjectIdString(stay.roomId) === roomId)
                .map((stay) => {
                    const stayStart = parseStoredDate(stay.rentalStartDate)
                    if (!stayStart) return null

                    const rawType = normalizeTenantType(stay.type)
                    const checkoutDate = parseStoredDate(stay.checkoutDate)
                    const rentalEndDate = parseStoredDate(stay.rentalEndDate)
                    const cancelledAt = parseStoredDate(stay.cancelledAt)
                    const stayEnd = checkoutDate ?? rentalEndDate ?? cancelledAt ?? (rawType === 'daily' ? stayStart : rangeEnd)

                    if (stayEnd.isBefore(rangeStart, 'day') || stayStart.isAfter(rangeEnd, 'day')) {
                        return null
                    }

                    const clippedStart = stayStart.isAfter(rangeStart) ? stayStart : rangeStart
                    const clippedEnd = stayEnd.isBefore(rangeEnd) ? stayEnd : rangeEnd
                    const tenant = tenantById.get(toObjectIdString(stay.tenantId))
                    const status = getEffectiveStayStatus(stay) as PortfolioBookingPlanSegmentDto['status']
                    const stayType: PortfolioBookingPlanSegmentDto['stayType'] = rawType === 'daily' ? 'daily' : rawType
                    const tenantName = String(tenant?.fullName ?? '').trim()
                    const ownerAccountId = toObjectIdString(stay.ownerAccountId ?? stay.accountId ?? room.accountId)
                    const ownerAccount = accountById.get(ownerAccountId)

                    return {
                        stayId: toObjectIdString(stay._id),
                        tenantId: toObjectIdString(stay.tenantId),
                        tenantName,
                        tenantPhone: String(tenant?.phone ?? '').trim(),
                        tenantBusinessSource: String(tenant?.businessSource ?? '').trim(),
                        stayType,
                        status,
                        startDate: clippedStart.format('YYYY-MM-DD'),
                        endDate: clippedEnd.format('YYYY-MM-DD'),
                        createdAt: stay.createdAt instanceof Date
                            ? stay.createdAt.toISOString()
                            : undefined,
                        startDay: clippedStart.diff(rangeStart, 'day') + 1,
                        endDay: clippedEnd.diff(rangeStart, 'day') + 1,
                        colorKey: `${ownerAccount?.slug || ownerAccountId}:${tenantName || toObjectIdString(stay.tenantId)}`,
                        ownerAccountSlug: ownerAccount?.slug,
                        ownerAccountName: ownerAccount?.name,
                        ownerColor: ownerAccount?.settings?.bookingColor,
                        isUnpaid:
                            unpaidByStayId.get(toObjectIdString(stay._id)) === true ||
                            (
                                ownerAccount?.slug !== 'dneth' &&
                                (invoiceCountByStayId.get(toObjectIdString(stay._id)) ?? 0) === 0
                            )
                    }
                })
                .filter((segment): segment is NonNullable<typeof segment> => segment !== null)

            const blockStart = parseStoredDate(room.blockedFrom)
            const blockEnd = parseStoredDate(room.blockedTo) ?? blockStart
            const roomStatus = String(room.status ?? '').trim().toLowerCase()

            if (
                (roomStatus === 'maintenance' || roomStatus === 'reserved') &&
                blockStart &&
                blockEnd &&
                !blockEnd.isBefore(rangeStart, 'day') &&
                !blockStart.isAfter(rangeEnd, 'day')
            ) {
                const clippedStart = blockStart.isAfter(rangeStart) ? blockStart : rangeStart
                const clippedEnd = blockEnd.isBefore(rangeEnd) ? blockEnd : rangeEnd

                segments.push({
                    stayId: `room-block:${roomId}:${roomStatus}`,
                    tenantId: '',
                    tenantName: roomStatus === 'maintenance' ? 'Maintenance' : 'Reserved',
                    tenantPhone: '',
                    stayType: 'daily',
                    status: roomStatus === 'maintenance' ? 'maintenance' : 'reserved',
                    startDate: clippedStart.format('YYYY-MM-DD'),
                    endDate: clippedEnd.format('YYYY-MM-DD'),
                    startDay: clippedStart.diff(rangeStart, 'day') + 1,
                    endDay: clippedEnd.diff(rangeStart, 'day') + 1,
                    colorKey: `room-block:${roomStatus}:${roomId}`,
                    remarks: String(room.blockedRemarks ?? '').trim()
                })
            }

            segments.sort((left, right) => {
                if (left.startDay !== right.startDay) return left.startDay - right.startDay
                return left.endDay - right.endDay
            })

            const sortedSegments = segments

            return {
                buildingId,
                buildingName,
                roomId,
                roomName: room.name,
                floor: room.floor ?? null,
                roomType: String(room.roomType ?? 'standard'),
                roomStatus: String(room.status ?? 'Vacant'),
                segments: sortedSegments
            }
        })
        .sort((left, right) => {
            const buildingCompare = left.buildingName.localeCompare(right.buildingName, undefined, { sensitivity: 'base' })
            if (buildingCompare !== 0) return buildingCompare

            const floorLeft = left.floor ?? 9999
            const floorRight = right.floor ?? 9999
            if (floorLeft !== floorRight) return floorLeft - floorRight

            return left.roomName.localeCompare(right.roomName, undefined, { sensitivity: 'base' })
        })

    return {
        month: monthLabel,
        startDate: rangeStart.format('YYYY-MM-DD'),
        endDate: rangeEnd.format('YYYY-MM-DD'),
        dayCount: rangeEnd.diff(rangeStart, 'day') + 1,
        isRange,
        rows: roomRows
    }
}
