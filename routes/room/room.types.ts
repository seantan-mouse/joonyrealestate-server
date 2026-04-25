export type RoomDetailDocumentType = 'contract' | 'visa' | 'passport' | 'other'

export type RoomDetailResponse = {
    room: {
        _id: string
        buildingId: string
        legacyBuildingId?: string
        legacyRoomId?: string
        name: string
        roomType?: string
        floor?: number | null
        status: string
        defaultRoomRate: number
        blockedFrom: string
        blockedTo: string
        blockedRemarks: string
        notes: string
        isActive: boolean
    }
    currentStay?: {
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
        status: string
        rentalStartDate?: string
        rentalEndDate?: string
        checkoutDate?: string
        roomRate: number
        depositAmount: number
        electricityRate: number
        waterRate: number
        electricityMeterStartAt: number
        waterMeterStartAt: number
        notes: string
    }
    stays: Array<{
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
        status: string
        rentalStartDate?: string
        rentalEndDate?: string
        checkoutDate?: string
        roomRate: number
        depositAmount: number
        electricityRate: number
        waterRate: number
        electricityMeterStartAt: number
        waterMeterStartAt: number
        notes: string
    }>
    readings: Array<{
        _id: string
        readingDate: string
        electricity: number
        water: number
        notes: string
    }>
    invoices: Array<{
        _id: string
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
        status: string
        outstandingAmount: number
        tenantName: string
        tenantPhone: string
        tenantLanguage: 'english' | 'khmer' | 'chinese' | 'japanese' | 'korean'
        tenantCurrency: 'USD' | 'Riel'
        tenantCheckInDate: string
    }>
    services: Array<{
        _id: string
        name: string
        type: string
        fee: number
        date: string
        notes: string
    }>
    documents: {
        contracts: Array<{
            _id: string
            type: RoomDetailDocumentType
            date: string
            tenantName: string
            link: string
            fileName: string
            notes: string
        }>
        visaPhotos: Array<{
            _id: string
            type: RoomDetailDocumentType
            date: string
            tenantName: string
            link: string
            fileName: string
            notes: string
        }>
        passportPhotos: Array<{
            _id: string
            type: RoomDetailDocumentType
            date: string
            tenantName: string
            link: string
            fileName: string
            notes: string
        }>
        others: Array<{
            _id: string
            type: RoomDetailDocumentType
            date: string
            tenantName: string
            link: string
            fileName: string
            notes: string
        }>
    }
}
