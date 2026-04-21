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

export type PortfolioComparisonMetricDto = {
    current: number
    previous: number
    delta: number
    deltaPct: number | null
}

export type PortfolioReportComparisonDto = {
    revenuePaid: PortfolioComparisonMetricDto
    revenueAccrued: PortfolioComparisonMetricDto
    cashCollected: PortfolioComparisonMetricDto
    arOutstanding: PortfolioComparisonMetricDto
    expenses: PortfolioComparisonMetricDto
    profitPaidBasis: PortfolioComparisonMetricDto
    profitAccrualBasis: PortfolioComparisonMetricDto
    occupancyRate: PortfolioComparisonMetricDto
    revpar: PortfolioComparisonMetricDto
    adr: PortfolioComparisonMetricDto
}

export type PortfolioReportKpisDto = BuildingReportKpisDto & {
    buildingCount: number
    roomCount: number
    invoiceCount: number
    outstandingInvoiceCount: number
    expenseCount: number
}

export type PortfolioReportBuildingRowDto = {
    buildingId: string
    buildingName: string
    roomCount: number
    invoiceCount: number
    expenseCount: number
    revenuePaid: number
    revenueAccrued: number
    cashCollected: number
    arOutstanding: number
    expenses: number
    profitPaidBasis: number
    occupancyRate: number
    revpar: number
    adr: number
}

export type PortfolioReportRoomRowDto = BuildingReportRoomRowDto & {
    buildingId: string
    buildingName: string
}

export type PortfolioInvoiceStatusBreakdownDto = {
    bucket: ReportInvoiceStatusFilter
    count: number
    total: number
    paidAmount: number
    outstanding: number
}

export type PortfolioExpenseScopeBreakdownDto = {
    scope: 'all' | 'selected' | 'unknown'
    count: number
    amount: number
}

export type PortfolioTenantTypeBreakdownDto = {
    tenantType: ReportTenantTypeFilter
    invoiceCount: number
    revenuePaid: number
    revenueAccrued: number
    outstanding: number
}

export type PortfolioReportDto = {
    scope: {
        buildingIds: string[]
        start: string
        end: string
        comparisonStart: string
        comparisonEnd: string
    }
    availableBuildings: Array<{
        _id: string
        name: string
    }>
    kpis: PortfolioReportKpisDto
    comparison: PortfolioReportComparisonDto
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

export type PortfolioBookingPlanSegmentDto = {
    stayId: string
    tenantId: string
    tenantName: string
    tenantPhone: string
    stayType: 'monthly' | 'daily' | 'contract'
    status: 'reserved' | 'active' | 'checked_out' | 'cancelled'
        | 'maintenance'
    startDate: string
    endDate: string
    createdAt?: string
    startDay: number
    endDay: number
    colorKey: string
    ownerAccountSlug?: string
    ownerAccountName?: string
    ownerColor?: string
    isUnpaid?: boolean
    remarks?: string
}

export type PortfolioBookingPlanRowDto = {
    buildingId: string
    buildingName: string
    roomId: string
    roomName: string
    floor: number | null
    roomType: string
    roomStatus: string
    segments: PortfolioBookingPlanSegmentDto[]
}

export type PortfolioBookingPlanDto = {
    month: string
    startDate: string
    endDate: string
    dayCount: number
    isRange: boolean
    availableBuildings: Array<{
        _id: string
        name: string
    }>
    rows: PortfolioBookingPlanRowDto[]
}

export type GetPortfolioReportInput = {
    scopedBuildingIds: string[]
    start: string
    end: string
    statuses: ReportInvoiceStatusFilter[]
    tenantTypes: ReportTenantTypeFilter[]
    includeRows?: boolean
}

export type GetPortfolioBookingPlanInput = {
    scopedBuildingIds: string[]
    month?: string
    start?: string
    end?: string
}
