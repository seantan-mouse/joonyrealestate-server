import { Types } from 'mongoose'

export type Primitive = string | number | boolean | null | undefined

export type RoomStatus = 'Vacant' | 'Occupied' | 'Reserved' | 'Maintenance'
export type StayStatus = 'reserved' | 'active' | 'checked_out' | 'cancelled'

export type LeanBuilding = {
    _id: Types.ObjectId
    accountId?: Types.ObjectId
    name: string
    code?: string
    notes?: string
    settings?: {
        roomsPerRow?: number
        interestRate?: number
    }
    isActive?: boolean
}

export type LeanRoom = {
    _id: Types.ObjectId
    buildingId: Types.ObjectId
    legacyBuildingId?: string
    legacyRoomId?: string
    name: string
    roomType?: string
    floor?: number | null
    status?: string
    defaultRoomRate?: number
    notes?: string
    isActive?: boolean
}

export type LeanStay = {
    _id: Types.ObjectId
    buildingId: Types.ObjectId
    roomId: Types.ObjectId
    tenantId: Types.ObjectId
    legacyBuildingId?: string
    legacyRoomId?: string
    legacyTenantRoomNo?: string
    type?: string
    status?: string
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

export type LeanTenant = {
    _id: Types.ObjectId
    fullName: string
    email?: string
    phone?: string
    country?: string
    gender?: string
    language?: string
    currency?: string
    rentalTypeDefault?: string
    dateOfBirth?: string
    identityNo?: string
    passportExpiryDate?: string
    visaExpiryDate?: string
    address?: string
    notes?: string
    isActive?: boolean
}

export type LeanInvoice = {
    _id: Types.ObjectId
    roomId: Types.ObjectId
    stayId?: Types.ObjectId | null
    tenantId?: Types.ObjectId | null
    invoiceNo: string
    date: string
    totalAmount?: number
    outstandingAmount?: number
    status?: string
    tenantNameSnapshot?: string
}

export type LeanPayment = {
    _id: Types.ObjectId
    invoiceId: Types.ObjectId
    paymentDate: string
    amount?: number
    type?: 'full' | 'partial'
    method?: 'cash' | 'bank' | 'khqr' | 'card' | 'other'
    notes?: string
    createdAt?: Date
}

export type BuildingSettingsDto = {
    roomsPerRow: number
    interestRate: number
}

export type BuildingSummaryDto = {
    _id: string
    name: string
    code: string
    notes: string
    isActive: boolean
    settings: BuildingSettingsDto
    roomCount: number
    occupiedRoomCount: number
    reservedRoomCount: number
    vacantRoomCount: number
    maintenanceRoomCount: number
}

export type BuildingDetailDto = {
    _id: string
    name: string
    code: string
    notes: string
    isActive: boolean
    settings: BuildingSettingsDto
}

export type BuildingRoomsCurrentStayDto = {
    _id: string
    tenantId: string
    tenantName: string
    type: string
    status: StayStatus
    rentalStartDate: string
    rentalEndDate: string
    checkoutDate: string
    roomRate: number
    depositAmount: number
    electricityRate: number
    waterRate: number
}

export type BuildingRoomsLatestInvoiceDto = {
    _id: string
    invoiceNo: string
    date: string
    status: string
    totalAmount: number
    outstandingAmount: number
}

export type BuildingRoomsRoomDto = {
    _id: string
    buildingId: string
    name: string
    roomType: string
    floor: number | null
    status: RoomStatus
    defaultRoomRate: number
    notes: string
    isActive: boolean
    currentStay: BuildingRoomsCurrentStayDto | null
    latestInvoice: BuildingRoomsLatestInvoiceDto | null
    overdue: {
        hasOverdue: boolean
        overdueDays: number
        totalOutstanding: number
    }
    nextInvoiceDate: string | null
}

export type BuildingRoomsDto = {
    building: {
        _id: string
        name: string
        settings: BuildingSettingsDto
    }
    rooms: BuildingRoomsRoomDto[]
}

export type BuildingOccupancyStayDto = {
    _id: string
    tenantId: string
    tenantName: string
    type: string
    status: StayStatus
    rentalStartDate: string
    rentalEndDate: string
    checkoutDate: string
}

export type BuildingOccupancyRoomDto = {
    _id: string
    name: string
    floor: number | null
    roomType: string
    roomStatus: RoomStatus
    currentStay: BuildingOccupancyStayDto | null
}

export type BuildingOccupancyDto = {
    building: {
        _id: string
        name: string
    }
    rooms: BuildingOccupancyRoomDto[]
}

export type PaymentMethod = 'cash' | 'bank' | 'khqr' | 'card' | 'other'
export type PaymentType = 'full' | 'partial'

export type PaymentsOverviewPaymentDto = {
    _id: string
    paymentDate: string
    amount: number
    type: PaymentType
    method: PaymentMethod
    notes: string
}

export type PaymentsOverviewInvoiceDto = {
    _id: string
    roomId: string
    roomName: string
    tenantId: string | null
    tenantName: string
    tenantPhone: string
    tenantLanguage: 'english' | 'khmer' | 'chinese' | 'japanese' | 'korean'
    tenantCurrency: 'USD' | 'Riel'
    tenantCheckInDate: string
    invoiceNo: string
    date: string
    billingPeriodStart: string
    billingPeriodEnd: string
    roomRate: number
    nightlyRate: number | null
    nights: number | null
    stayStart: string
    stayEnd: string
    electricityRate: number
    waterRate: number
    oldElectricityReading: number
    electricityReading: number
    electricityPrice: number
    oldWaterReading: number
    waterReading: number
    waterPrice: number
    services: string
    servicesFee: number
    others: string
    othersFee: number
    previousBalance: number
    totalAmount: number
    totalAmountRiel: number
    status: 'Paid' | 'Not paid' | 'Partially paid' | 'Voided'
    outstandingAmount: number
    payment: PaymentsOverviewPaymentDto | null
}

export type PaymentsOverviewRoomDto = {
    _id: string
    buildingId: string
    name: string
    roomType: string
    floor: number | null
    status: RoomStatus
    defaultRoomRate: number
    notes: string
    isActive: boolean
    currentStay: BuildingRoomsCurrentStayDto | null
}

export type PaymentsOverviewDto = {
    building: {
        _id: string
        name: string
        settings: BuildingSettingsDto
    }
    rooms: PaymentsOverviewRoomDto[]
    invoices: PaymentsOverviewInvoiceDto[]
}
