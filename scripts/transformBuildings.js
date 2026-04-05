const fs = require('fs').promises
const path = require('path')

const readJson = async (p) => JSON.parse(await fs.readFile(p, 'utf8'))

const groupBy = (arr, keyFn) => {
    const map = new Map()
    for (const item of arr) {
        const key = keyFn(item)
        if (!map.has(key)) map.set(key, [])
        map.get(key).push(item)
    }
    return map
}

const toISODate = (value) => {
    if (!value) return undefined
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return undefined
    return date.toISOString().split('T')[0]
}

const n = (value) => {
    if (value === null || value === undefined || value === '') return 0
    const num = Number(value)
    return Number.isFinite(num) ? num : 0
}

const normalizeLocationId = (value) => {
    const raw = String(value ?? '').trim()
    if (!raw) return ''
    if (/^\d+$/.test(raw)) return raw.padStart(3, '0')
    return raw.toUpperCase()
}

const khmerDigitMap = {
    '០': '0',
    '១': '1',
    '២': '2',
    '៣': '3',
    '៤': '4',
    '៥': '5',
    '៦': '6',
    '៧': '7',
    '៨': '8',
    '៩': '9'
}

const normalizeDigits = (value) =>
    String(value ?? '').replace(/[០-៩]/g, (digit) => khmerDigitMap[digit] ?? digit)

const candidateRoomIds = (value) => {
    const normalized = normalizeDigits(value).trim()
    if (!normalized) return []

    const candidates = new Set([normalized])

    if (/^\d+$/.test(normalized)) {
        candidates.add(String(Number(normalized)))
        candidates.add(normalized.padStart(2, '0'))
        candidates.add(normalized.padStart(3, '0'))
    }

    return [...candidates]
}

const parseRoomIdFromFileName = (fileName) => {
    const normalized = normalizeDigits(fileName).toLowerCase()
    const match = normalized.match(/(?:room|បន្ទប់)\s*#?\s*(\d+)/i) || normalized.match(/(\d+)/)
    return match?.[1] ? match[1] : ''
}

const mapRoomStatus = (roomStatus, roomRentStatus) => {
    if (roomStatus === 'R') return 'Reserved'
    if (roomRentStatus === 'R') return 'Occupied'
    return 'Vacant'
}

const mapInvoiceStatus = (invoiceStatus) => {
    if (!invoiceStatus) return 'Not paid'
    const status = String(invoiceStatus).toUpperCase()
    if (status === 'A') return 'Paid'
    if (status === 'S') return 'Partially paid'
    if (status === 'D') return 'Not paid'
    return 'Not paid'
}

const contractSortKey = (contract) => {
    const value = contract.RetalDate || contract.RentalDate || contract.CreateDate
    const date = new Date(value || 0)
    return Number.isNaN(date.getTime()) ? 0 : date.getTime()
}

const makeRoomKey = (locationId, roomId) => `${normalizeLocationId(locationId)}::${String(roomId ?? '').trim()}`

async function transformBuildings() {
    const sqlDir = path.join('data', 'sql')
    const debugDir = path.join('data', 'debug')

    const customers = await readJson(path.join(sqlDir, 'dbo_Customer.json'))
    const customerContracts = await readJson(path.join(sqlDir, 'dbo_CustomerContract.json'))
    const locations = await readJson(path.join(sqlDir, 'dbo_Location.json'))
    const rooms = await readJson(path.join(sqlDir, 'dbo_Room.json'))
    const receipts = await readJson(path.join(sqlDir, 'dbo_ReceiptHeader.json'))
    const receiptDetails = await readJson(path.join(sqlDir, 'dbo_ReceiptDetails.json'))
    const rentalServices = await readJson(path.join(sqlDir, 'dbo_RentalServices.json'))
    const servicesMaster = await readJson(path.join(sqlDir, 'dbo_Service.json'))
    const expenses = await readJson(path.join(sqlDir, 'dbo_Expense.json'))
    const documentFiles = await readJson(path.join(sqlDir, 'dbo_DocumentFile.json'))

    const normalizedLocations = locations.map((location) => ({
        ...location,
        LocationId: normalizeLocationId(location.LocationId)
    }))

    const normalizedRooms = rooms.map((room) => ({
        ...room,
        LocationId: normalizeLocationId(room.LocationId)
    }))

    const normalizedContracts = customerContracts.map((contract) => ({
        ...contract,
        LocationId: normalizeLocationId(contract.LocationId)
    }))

    const normalizedReceipts = receipts.map((receipt) => ({
        ...receipt,
        LocationId: normalizeLocationId(receipt.LocationId)
    }))

    const normalizedExpenses = expenses.map((expense) => ({
        ...expense,
        LocationId: normalizeLocationId(expense.LocationId)
    }))

    const customerById = new Map(customers.map((customer) => [String(customer.CustomerID), customer]))
    const serviceById = new Map(servicesMaster.map((service) => [String(service.ServiceID), service]))
    const contractByRentalId = new Map(
        normalizedContracts.map((contract) => [String(contract.RentalId), contract])
    )

    const contractsByRoomKey = groupBy(normalizedContracts, (contract) =>
        makeRoomKey(contract.LocationId, contract.RoomID)
    )
    const receiptsByRentalId = groupBy(normalizedReceipts, (receipt) => String(receipt.RentalId))
    const receiptDetailsByInvoiceNo = groupBy(receiptDetails, (detail) => String(detail.InvoiceNo))
    const servicesByRentalId = groupBy(rentalServices, (service) => String(service.RentalId))
    const roomsByLocationId = groupBy(normalizedRooms, (room) => normalizeLocationId(room.LocationId))
    const expensesByLocationId = groupBy(normalizedExpenses, (expense) =>
        normalizeLocationId(expense.LocationId)
    )
    const roomKeysByLocationId = new Map()

    for (const [locationId, locationRooms] of roomsByLocationId.entries()) {
        roomKeysByLocationId.set(
            locationId,
            new Set(locationRooms.map((room) => String(room.RoomID)))
        )
    }

    const audit = {
        source: {
            locations: normalizedLocations.length,
            rooms: normalizedRooms.length,
            contracts: normalizedContracts.length,
            receipts: normalizedReceipts.length,
            receiptDetails: receiptDetails.length,
            rentalServices: rentalServices.length,
            expenses: normalizedExpenses.length,
            documentFiles: documentFiles.length
        },
        warnings: {
            orphanReceipts: [],
            unmatchedDocuments: [],
            recoveredLocationIds: []
        }
    }

    for (const room of rooms) {
        const before = String(room.LocationId ?? '').trim()
        const after = normalizeLocationId(room.LocationId)
        if (before && before !== after) {
            audit.warnings.recoveredLocationIds.push({
                roomId: String(room.RoomID ?? ''),
                before,
                after
            })
        }
    }

    const toTenant = (contract, customer) => {
        const name = customer?.FullName || customer?.CustomerName || 'Unknown'
        const genderRaw = customer?.Gender || customer?.CustomerGender || ''
        const gender =
            genderRaw === 'M'
                ? 'male'
                : genderRaw === 'F'
                  ? 'female'
                  : undefined

        return {
            roomNo: contract.RoomID,
            latestInvoice: undefined,
            name,
            email: undefined,
            phone: customer?.CustomerPhone || undefined,
            country: customer?.CustomerPOB || undefined,
            gender,
            language: 'english',
            currency: 'USD',
            rentalType: 'monthly',
            rentalStartDate: toISODate(contract.RetalDate || contract.RentalDate || contract.CreateDate),
            rentalEndDate: toISODate(contract.EndDate),
            checkoutDate: undefined,
            visaExpiryDate: undefined,
            passportExpiryDate: undefined,
            address: customer?.CustomerAdd || customer?.CustomerPOB || undefined,
            dateOfBirth: toISODate(customer?.CustomerDOB),
            identityNo: customer?.CustomerIDNumber || undefined,
            roomRate: n(contract.RentalPrice),
            depositAmount: n(contract.BookAmount),
            electricityRate: n(contract.ElectricPrice),
            electricityMeterStartAt: n(contract.ElectricOldNo),
            waterRate: n(contract.WaterPrice),
            waterMeterStartAt: n(contract.WaterOldNo),
            notes: ''
        }
    }

    const pickInvoiceDate = (receipt) =>
        toISODate(receipt.InvoiceDate || receipt.ReceiveDate || receipt.PeriodCode || receipt.CreateDate) || ''

    const toInvoice = (roomId, tenantName, tenantPhone, receipt, details, serviceLines, contract) => {
        const invoiceNo =
            receipt.InvoiceNo ||
            `INV-${roomId}-${String(receipt.CreateDate || receipt.InvoiceDate || receipt.ReceiveDate || Date.now())}`

        const serviceNames = []
        let servicesFee = 0

        for (const line of serviceLines) {
            const serviceMaster = serviceById.get(String(line.ServiceID))
            const serviceName = serviceMaster?.ServiceName || line.Memo || `Service ${line.ServiceID}`
            serviceNames.push(serviceName)
            servicesFee += n(line.Price)
        }

        let othersFee = 0
        for (const detail of details) othersFee += n(detail.Price)

        const electricityReading = n(receipt.ElectricNo)
        const oldElectricityReading = n(receipt.ElectricOldNo)
        const electricityRate = n(receipt.ElectricPrice)
        const electricityPrice =
            Math.max(0, electricityReading - oldElectricityReading) * electricityRate

        const waterReading = n(receipt.WaterNo)
        const oldWaterReading = n(receipt.WaterOldNo)
        const waterRate = n(receipt.WaterPrice)
        const waterPrice = Math.max(0, waterReading - oldWaterReading) * waterRate

        const roomRate = receipt.RentalPrice != null ? n(receipt.RentalPrice) : n(contract?.RentalPrice)
        const totalAmount =
            receipt.Amount != null
                ? n(receipt.Amount)
                : roomRate + electricityPrice + waterPrice + servicesFee + othersFee

        const status = mapInvoiceStatus(receipt.InvoiceStatus)
        const isPaid = status === 'Paid'

        return {
            room: roomId,
            tenantName: tenantName || '',
            invoiceNo,
            date: pickInvoiceDate(receipt),
            roomRate,
            nightlyRate: undefined,
            nights: undefined,
            electricityRate,
            waterRate,
            oldElectricityReading,
            electricityReading,
            electricityPrice,
            oldWaterReading,
            waterReading,
            waterPrice,
            services: serviceNames.join(', '),
            servicesFee,
            others: receipt.InvoiceMemo || '',
            othersFee,
            totalAmount,
            totalAmountRiel: 0,
            status,
            payment: isPaid
                ? {
                      type: 'full',
                      amount: totalAmount,
                      notes: 'Imported from legacy paid invoice status'
                  }
                : undefined,
            outstandingAmount: isPaid ? 0 : totalAmount,
            tenantPhone: tenantPhone || '',
            tenantLanguage: 'english',
            tenantCurrency: 'USD',
            previousBalance: undefined
        }
    }

    const buildCurrentRoomServices = (latestContract) => {
        if (!latestContract) return []

        const serviceLines = servicesByRentalId.get(String(latestContract.RentalId)) || []
        const dedupe = new Set()
        const date =
            toISODate(latestContract.RetalDate || latestContract.RentalDate || latestContract.CreateDate) || ''

        return serviceLines
            .map((line) => {
                const serviceMaster = serviceById.get(String(line.ServiceID))
                const name = serviceMaster?.ServiceName || line.Memo || `Service ${line.ServiceID}`
                const fee = n(line.Price || serviceMaster?.ServicePrice)
                const key = [name, fee, date].join('::')

                if (dedupe.has(key)) return null
                dedupe.add(key)

                return {
                    name,
                    type: 'Monthly',
                    fee,
                    date,
                    notes: line.Memo || ''
                }
            })
            .filter(Boolean)
    }

    const documentsByRoomKey = new Map()

    const pushDocumentToRoom = (roomKey, bucket, document) => {
        const existing =
            documentsByRoomKey.get(roomKey) || {
                contracts: [],
                visaPhotos: [],
                passportPhotos: [],
                otherFiles: []
            }
        existing[bucket].push(document)
        documentsByRoomKey.set(roomKey, existing)
    }

    for (const documentFile of documentFiles) {
        const linkedContract = contractByRentalId.get(String(documentFile.RentalCode))
        const fileName = String(documentFile.FileName || '').trim()
        const contentType = String(documentFile.FileContentType || 'application/octet-stream').trim()
        const base64 = String(documentFile.FileData || '').trim()

        if (!linkedContract) {
            audit.warnings.unmatchedDocuments.push({
                reason: 'missing-linked-contract',
                rentalCode: String(documentFile.RentalCode || ''),
                fileName
            })
            continue
        }

        const locationId = normalizeLocationId(linkedContract.LocationId)
        const roomIdsInLocation = roomKeysByLocationId.get(locationId) || new Set()
        const parsedRoomId = parseRoomIdFromFileName(fileName)
        const candidateIds = [
            ...candidateRoomIds(parsedRoomId),
            ...candidateRoomIds(linkedContract.RoomID)
        ]
        const matchedRoomId = candidateIds.find((candidate) => roomIdsInLocation.has(candidate))

        if (!matchedRoomId || !base64) {
            audit.warnings.unmatchedDocuments.push({
                reason: matchedRoomId ? 'missing-file-data' : 'missing-room-match',
                rentalCode: String(documentFile.RentalCode || ''),
                fileName,
                locationId,
                contractRoomId: String(linkedContract.RoomID || ''),
                parsedRoomId
            })
            continue
        }

        const customer = customerById.get(String(linkedContract.CustomerID))
        const tenantName = customer?.FullName || customer?.CustomerName || ''
        const link = `data:${contentType};base64,${base64}`
        const date = toISODate(documentFile.ModifyDate || documentFile.CreateDate || linkedContract.CreateDate)

        let bucket = 'otherFiles'
        const loweredName = fileName.toLowerCase()

        if (loweredName.includes('visa')) bucket = 'visaPhotos'
        else if (loweredName.includes('passport')) bucket = 'passportPhotos'
        else if (contentType.startsWith('application/') || loweredName.endsWith('.doc') || loweredName.endsWith('.docx') || loweredName.endsWith('.pdf')) {
            bucket = 'contracts'
        }

        pushDocumentToRoom(makeRoomKey(locationId, matchedRoomId), bucket, {
            date,
            tenantName,
            fileName,
            link
        })
    }

    const orphanReceipts = normalizedReceipts.filter(
        (receipt) => !contractByRentalId.has(String(receipt.RentalId))
    )

    audit.warnings.orphanReceipts = orphanReceipts.map((receipt) => ({
        invoiceNo: String(receipt.InvoiceNo || ''),
        rentalId: String(receipt.RentalId || ''),
        locationId: normalizeLocationId(receipt.LocationId),
        invoiceDate: pickInvoiceDate(receipt),
        amount: n(receipt.Amount),
        status: String(receipt.InvoiceStatus || '')
    }))

    const buildings = normalizedLocations.map((location) => {
        const locRooms = roomsByLocationId.get(location.LocationId) || []

        const mappedRooms = locRooms.map((room) => {
            const status = mapRoomStatus(room.RoomStatus, room.RoomRentStatus)
            const roomKey = makeRoomKey(location.LocationId, room.RoomID)
            const contracts = (contractsByRoomKey.get(roomKey) || [])
                .slice()
                .sort((left, right) => contractSortKey(left) - contractSortKey(right))

            const tenants = contracts.map((contract) => {
                const customer = customerById.get(String(contract.CustomerID)) || null
                return toTenant(contract, customer)
            })

            const currentTenant = tenants.length ? tenants[tenants.length - 1] : undefined
            const latestContract = contracts.length ? contracts[contracts.length - 1] : null

            const invoices = []
            const readings = []

            for (const contract of contracts) {
                const contractCustomer = customerById.get(String(contract.CustomerID)) || null
                const contractTenant = toTenant(contract, contractCustomer)
                const roomReceipts = receiptsByRentalId.get(String(contract.RentalId)) || []
                const serviceLines = servicesByRentalId.get(String(contract.RentalId)) || []

                for (const receipt of roomReceipts) {
                    const details = receiptDetailsByInvoiceNo.get(String(receipt.InvoiceNo)) || []
                    invoices.push(
                        toInvoice(
                            room.RoomID,
                            contractTenant?.name || '',
                            contractTenant?.phone || '',
                            receipt,
                            details,
                            serviceLines,
                            contract
                        )
                    )

                    readings.push({
                        electricity: n(receipt.ElectricNo),
                        water: n(receipt.WaterNo),
                        date:
                            toISODate(
                                receipt.ReceiveDate ||
                                    receipt.InvoiceDate ||
                                    receipt.PeriodCode ||
                                    receipt.CreateDate
                            ) || ''
                    })
                }
            }

            invoices.sort((left, right) => new Date(left.date || 0).getTime() - new Date(right.date || 0).getTime())
            readings.sort((left, right) => new Date(left.date || 0).getTime() - new Date(right.date || 0).getTime())

            if (currentTenant && invoices.length) {
                const currentTenantInvoices = invoices.filter(
                    (invoice) => invoice.tenantName === currentTenant.name
                )
                if (currentTenantInvoices.length) {
                    currentTenant.latestInvoice = currentTenantInvoices[currentTenantInvoices.length - 1]
                }
            }

            const roomDocuments =
                documentsByRoomKey.get(roomKey) || {
                    contracts: [],
                    visaPhotos: [],
                    passportPhotos: [],
                    otherFiles: []
                }

            return {
                id: room.RoomID,
                name: room.RoomID,
                status,
                notes: room.RoomMap || room.RoomMemo || '',
                tenant: currentTenant,
                tenants,
                readings,
                invoices,
                services: buildCurrentRoomServices(latestContract),
                contracts: roomDocuments.contracts,
                visaPhotos: roomDocuments.visaPhotos,
                passportPhotos: roomDocuments.passportPhotos,
                otherFiles: roomDocuments.otherFiles,
                roomRate: currentTenant?.roomRate || undefined
            }
        })

        const locExpenses = (expensesByLocationId.get(location.LocationId) || []).map((expense) => ({
            name: expense.ExpDesc || 'Unknown Expense',
            type: 'general',
            date: toISODate(expense.ExpDate),
            amount: n(expense.ExpAmount),
            applyToRoomsType: 'general-expense',
            selectedRooms: [],
            notes: ''
        }))

        return {
            name: location.LocationName || `Building ${location.LocationId}`,
            rooms: mappedRooms,
            expenses: locExpenses,
            services: [],
            settings: {
                roomsPerRow: 8,
                interestRate: 0
            },
            notes: ''
        }
    })

    const transformedCounts = {
        buildings: buildings.length,
        rooms: 0,
        tenants: 0,
        invoices: 0,
        readings: 0,
        roomServices: 0,
        expenses: 0,
        documents: 0
    }

    for (const building of buildings) {
        transformedCounts.expenses += (building.expenses || []).length
        for (const room of building.rooms || []) {
            transformedCounts.rooms += 1
            transformedCounts.tenants += (room.tenants || []).length
            transformedCounts.invoices += (room.invoices || []).length
            transformedCounts.readings += (room.readings || []).length
            transformedCounts.roomServices += (room.services || []).length
            transformedCounts.documents +=
                (room.contracts || []).length +
                (room.visaPhotos || []).length +
                (room.passportPhotos || []).length +
                (room.otherFiles || []).length
        }
    }

    audit.transformed = transformedCounts

    await fs.mkdir(debugDir, { recursive: true })
    await fs.writeFile(path.join('data', 'buildings.json'), JSON.stringify(buildings, null, 2))
    await fs.writeFile(
        path.join(debugDir, 'legacy-import-audit.json'),
        JSON.stringify(audit, null, 2)
    )

    console.log(`[transformBuildings] wrote data/buildings.json (${buildings.length} buildings)`)
    console.log(
        `[transformBuildings] wrote ${path.join('data', 'debug', 'legacy-import-audit.json')}`
    )
}

transformBuildings().catch((error) => {
    console.error('[transformBuildings] error:', error)
    process.exit(1)
})
