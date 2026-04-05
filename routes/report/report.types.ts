export type ReportInvoiceStatusFilter = 'Paid' | 'Partial' | 'New' | 'Overdue'
export type ReportTenantTypeFilter = 'monthly' | 'contract'

export type BuildingReportInvoiceRowDto = {
    _id: string
    invoiceNo: string
    date: string
    roomName: string
    tenantName: string
    status: string
    total: number
    paidAmount: number
    outstanding: number
    isContract: boolean
    nightlyRate: number | null
    nights: number | null
}

export type BuildingReportExpenseRowDto = {
    _id: string
    date: string
    name: string
    type: string
    amount: number
    scope: 'all' | 'selected' | 'unknown'
    selectedRooms: string[]
    notes: string
}

export type BuildingReportMonthlyRowDto = {
    month: string
    revenuePaid: number
    revenueAccrued: number
    cashCollected: number
    expenses: number
}

export type BuildingReportARAgingRowDto = {
    label: string
    amount: number
    count: number
}

export type BuildingReportRoomRowDto = {
    room: string
    revenuePaid: number
    revenueAccrued: number
    cashCollected: number
    arOutstanding: number
    expensesAllocated: number
    profitPaidBasis: number
    occupancyRate: number
}

export type BuildingReportKpisDto = {
    revenuePaid: number
    revenueAccrued: number
    cashCollected: number
    arOutstanding: number
    expenses: number
    profitPaidBasis: number
    profitAccrualBasis: number
    occupancyRate: number
    revpar: number
    adr: number
}

export type BuildingReportDto = {
    building: {
        _id: string
        name: string
        settings: {
            roomsPerRow: number
            interestRate: number
        }
    }
    availableRooms: string[]
    invoiceRows: BuildingReportInvoiceRowDto[]
    expenseRows: BuildingReportExpenseRowDto[]
    kpis: BuildingReportKpisDto
    monthly: BuildingReportMonthlyRowDto[]
    arAging: BuildingReportARAgingRowDto[]
    roomSummary: BuildingReportRoomRowDto[]
}

export type GetBuildingReportInput = {
    buildingId: string
    start: string
    end: string
    rooms: string[]
    statuses: ReportInvoiceStatusFilter[]
    tenantTypes: ReportTenantTypeFilter[]
}