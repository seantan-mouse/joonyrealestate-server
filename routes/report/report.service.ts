import { Types } from 'mongoose'
import dayjs, { Dayjs } from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import Building from '../../models/Building'
import Room from '../../models/Room'
import Stay from '../../models/Stay'
import Invoice from '../../models/Invoice'
import Payment from '../../models/Payment'
import Expense from '../../models/Expense'
import type {
    BuildingReportARAgingRowDto,
    BuildingReportDto,
    BuildingReportExpenseRowDto,
    BuildingReportInvoiceRowDto,
    BuildingReportKpisDto,
    BuildingReportMonthlyRowDto,
    BuildingReportRoomRowDto,
    GetBuildingReportInput,
    ReportInvoiceStatusFilter,
    ReportTenantTypeFilter
} from './report.types'

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
    buildingId: Types.ObjectId
    name: string
    roomType?: string
    floor?: number | null
    status?: string
    defaultRoomRate?: number
    notes?: string
    isActive?: boolean
}

type LeanStay = {
    _id: Types.ObjectId
    buildingId: Types.ObjectId
    roomId: Types.ObjectId
    tenantId: Types.ObjectId
    type?: string
    status?: string
    rentalStartDate?: string
    rentalEndDate?: string
    checkoutDate?: string
    cancelledAt?: string
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
    roomId: string
    invoiceDate: Dayjs
    statusBucket: ReportInvoiceStatusFilter
}

type NormalizedExpenseRow = BuildingReportExpenseRowDto & {
    expenseDate: Dayjs
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
        'DD/MM/YYYY'
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

function normalizeTenantType(value?: string): ReportTenantTypeFilter {
    return value === 'contract' ? 'contract' : 'monthly'
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

function getStayStartDate(stay: LeanStay): Dayjs | null {
    return parseStoredDate(stay.rentalStartDate)
}

function getStayEndDate(stay: LeanStay, rangeEnd: Dayjs): Dayjs {
    const checkoutDate = parseStoredDate(stay.checkoutDate)
    if (checkoutDate) return checkoutDate

    const rentalEndDate = parseStoredDate(stay.rentalEndDate)
    if (rentalEndDate) return rentalEndDate

    const cancelledAt = parseStoredDate(stay.cancelledAt)
    if (cancelledAt) return cancelledAt

    return rangeEnd
}

function getOverlapDays(args: {
    stay: LeanStay
    rangeStart: Dayjs
    rangeEnd: Dayjs
}): number {
    const { stay, rangeStart, rangeEnd } = args

    const stayStart = getStayStartDate(stay)
    if (!stayStart) return 0

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

export async function getBuildingReport(input: GetBuildingReportInput): Promise<BuildingReportDto | null> {
    if (!Types.ObjectId.isValid(input.buildingId)) return null

    const buildingId = new Types.ObjectId(input.buildingId)

    const building = await Building.findById(buildingId).lean<LeanBuilding | null>()
    if (!building) return null

    const rangeStart = parseStoredDate(input.start)
    const rangeEnd = parseStoredDate(input.end)

    if (!rangeStart || !rangeEnd) return null

    const [rooms, stays, invoices, payments, expenses] = await Promise.all([
        Room.find({ buildingId }).lean<LeanRoom[]>(),
        Stay.find({ buildingId }).lean<LeanStay[]>(),
        Invoice.find({ buildingId }).lean<LeanInvoice[]>(),
        Payment.find({ buildingId }).lean<LeanPayment[]>(),
        Expense.find({ buildingId }).lean<LeanExpense[]>()
    ])

    const roomById = new Map<string, LeanRoom>(
        rooms.map((room) => [toObjectIdString(room._id), room])
    )

    const roomNameById = new Map<string, string>(
        rooms.map((room) => [toObjectIdString(room._id), room.name])
    )

    const availableRooms = rooms
        .map((room) => room.name)
        .filter(Boolean)
        .sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base' }))

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

            const roomId = toObjectIdString(invoice.roomId)
            const roomName = roomNameById.get(roomId) ?? ''
            const invoiceDate = parseStoredDate(invoice.date)

            if (!invoiceDate || !roomName) {
                return null
            }

            const invoicePayments = paymentsByInvoiceId.get(toObjectIdString(invoice._id)) ?? []
            const paidAmount = invoicePayments.reduce((sum, payment) => {
                return sum + toNumber(payment.amount, 0)
            }, 0)

            const total = toNumber(invoice.totalAmount, 0)
            const explicitOutstanding = toNumber(invoice.outstandingAmount, 0)
            const outstanding = explicitOutstanding > 0
                ? explicitOutstanding
                : Math.max(0, total - paidAmount)

            const isContract =
                (toNumber(invoice.nightlyRate, 0) > 0 && toNumber(invoice.nights, 0) > 0) ||
                normalizeTenantType(
                    stays.find((stay) => toObjectIdString(stay._id) === toObjectIdString(invoice.stayId ?? null))?.type
                ) === 'contract'

            const statusBucket = deriveInvoiceStatusBucket({
                rawStatus: invoice.status,
                outstanding,
                invoiceDate
            })

            return {
                _id: toObjectIdString(invoice._id),
                roomId,
                invoiceNo: invoice.invoiceNo,
                date: invoice.date,
                roomName,
                tenantName: String(invoice.tenantNameSnapshot ?? '').trim(),
                status: String(invoice.status ?? 'Not paid'),
                total,
                paidAmount,
                outstanding,
                isContract,
                nightlyRate: invoice.nightlyRate ?? null,
                nights: invoice.nights ?? null,
                invoiceDate,
                statusBucket
            }
        })
        .filter((row): row is NormalizedInvoiceRow => row !== null)

    const normalizedExpenses: NormalizedExpenseRow[] = expenses
        .map((expense) => {
            const expenseDate = parseStoredDate(expense.date)
            if (!expenseDate) return null

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

    const selectedRoomSet = new Set(input.rooms)
    const hasRoomFilter = selectedRoomSet.size > 0
    const statusSet = new Set(input.statuses)
    const hasStatusFilter = statusSet.size > 0
    const tenantTypeSet = new Set(input.tenantTypes)
    const hasTenantTypeFilter = tenantTypeSet.size > 0

    const filteredInvoices = normalizedInvoices.filter((invoice) => {
        if (!inRangeInclusive(invoice.invoiceDate, rangeStart, rangeEnd)) return false
        if (hasRoomFilter && !selectedRoomSet.has(invoice.roomName)) return false
        if (hasStatusFilter && !statusSet.has(invoice.statusBucket)) return false

        if (hasTenantTypeFilter) {
            const tenantType: ReportTenantTypeFilter = invoice.isContract ? 'contract' : 'monthly'
            if (!tenantTypeSet.has(tenantType)) return false
        }

        return true
    })

    const filteredExpenses = normalizedExpenses.filter((expense) => {
        if (!inRangeInclusive(expense.expenseDate, rangeStart, rangeEnd)) return false

        if (hasRoomFilter) {
            if (expense.scope === 'all') return true
            if (expense.scope === 'selected') {
                return expense.selectedRooms.some((room) => selectedRoomSet.has(room))
            }
        }

        return true
    })

    const roomNamesInScope = hasRoomFilter ? Array.from(selectedRoomSet) : availableRooms

    const revenuePaid = filteredInvoices
        .filter((invoice) => invoice.statusBucket === 'Paid')
        .reduce((sum, invoice) => sum + invoice.total, 0)

    const revenueAccrued = filteredInvoices.reduce((sum, invoice) => sum + invoice.total, 0)
    const cashCollected = filteredInvoices.reduce((sum, invoice) => sum + invoice.paidAmount, 0)
    const arOutstanding = filteredInvoices.reduce((sum, invoice) => sum + invoice.outstanding, 0)
    const expensesTotal = filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0)

    const filteredStays = stays.filter((stay) => {
        const roomName = roomNameById.get(toObjectIdString(stay.roomId)) ?? ''
        if (!roomName) return false
        if (hasRoomFilter && !selectedRoomSet.has(roomName)) return false

        if (hasTenantTypeFilter) {
            const tenantType = normalizeTenantType(stay.type)
            if (!tenantTypeSet.has(tenantType)) return false
        }

        return true
    })

    const totalDays = daysBetween(rangeStart, rangeEnd) + 1
    const totalRoomDays = Math.max(1, totalDays * Math.max(1, roomNamesInScope.length))

    const occupiedRoomDays = filteredStays.reduce((sum, stay) => {
        return sum + getOverlapDays({
            stay,
            rangeStart,
            rangeEnd
        })
    }, 0)

    const occupancyRate = Math.min(1, occupiedRoomDays / totalRoomDays)
    const revpar = revenuePaid / totalRoomDays
    const adr = occupiedRoomDays > 0 ? revenuePaid / occupiedRoomDays : 0

    const kpis: BuildingReportKpisDto = {
        revenuePaid,
        revenueAccrued,
        cashCollected,
        arOutstanding,
        expenses: expensesTotal,
        profitPaidBasis: revenuePaid - expensesTotal,
        profitAccrualBasis: revenueAccrued - expensesTotal,
        occupancyRate,
        revpar,
        adr
    }

    const monthlyKeys = new Set<string>()
    filteredInvoices.forEach((invoice) => monthlyKeys.add(monthKey(invoice.invoiceDate)))
    filteredExpenses.forEach((expense) => monthlyKeys.add(monthKey(expense.expenseDate)))

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

    const allScopeExpenses = filteredExpenses.filter((expense) => expense.scope === 'all')
    const allScopePerRoom =
        roomNamesInScope.length > 0
            ? allScopeExpenses.reduce((sum, expense) => sum + expense.amount, 0) / roomNamesInScope.length
            : 0

    const selectedScopeExpenses = filteredExpenses.filter((expense) => expense.scope === 'selected')

    const roomSummary: BuildingReportRoomRowDto[] = roomNamesInScope
        .map((roomName) => {
            const roomInvoices = filteredInvoices.filter((invoice) => invoice.roomName === roomName)
            const roomEntity = rooms.find((room) => room.name === roomName)

            const roomStays = filteredStays.filter((stay) => {
                return toObjectIdString(stay.roomId) === toObjectIdString(roomEntity?._id ?? null)
            })

            const roomOccupiedDays = roomStays.reduce((sum, stay) => {
                return sum + getOverlapDays({
                    stay,
                    rangeStart,
                    rangeEnd
                })
            }, 0)

            const selectedAllocated = selectedScopeExpenses.reduce((sum, expense) => {
                if (!expense.selectedRooms.includes(roomName)) return sum
                return sum + (expense.amount / Math.max(1, expense.selectedRooms.length))
            }, 0)

            const expensesAllocated = allScopePerRoom + selectedAllocated
            const revenuePaidForRoom = roomInvoices
                .filter((invoice) => invoice.statusBucket === 'Paid')
                .reduce((sum, invoice) => sum + invoice.total, 0)

            return {
                room: roomName,
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

    return {
        building: {
            _id: toObjectIdString(building._id),
            name: building.name,
            settings: {
                roomsPerRow: building.settings?.roomsPerRow ?? 8,
                interestRate: building.settings?.interestRate ?? 0
            }
        },
        availableRooms,
        invoiceRows: filteredInvoices.map((invoice) => ({
            _id: invoice._id,
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
        })),
        expenseRows: filteredExpenses.map((expense) => ({
            _id: expense._id,
            date: expense.date,
            name: expense.name,
            type: expense.type,
            amount: expense.amount,
            scope: expense.scope,
            selectedRooms: expense.selectedRooms,
            notes: expense.notes
        })),
        kpis,
        monthly,
        arAging,
        roomSummary
    }
}
