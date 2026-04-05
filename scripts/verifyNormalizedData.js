require('dotenv').config()
const mongoose = require('mongoose')

const resolveModel = (path) => {
    const mod = require(path)
    return mod.default || mod
}

const LegacyBuilding = resolveModel('../models/LegacyBuilding')
const Room = resolveModel('../models/Room')
const Stay = resolveModel('../models/Stay')
const Tenant = resolveModel('../models/Tenant')
const MeterReading = resolveModel('../models/MeterReading')
const Invoice = resolveModel('../models/Invoice')
const Payment = resolveModel('../models/Payment')
const Expense = resolveModel('../models/Expense')
const Service = resolveModel('../models/Service')
const Document = resolveModel('../models/Document')

async function run() {
    await mongoose.connect(process.env.MONGODB_URI)
    console.log('[verify] connected')

    const legacyBuildings = await LegacyBuilding.find().lean()

    let oldRooms = 0
    let oldTenants = 0
    let oldReadings = 0
    let oldInvoices = 0
    let oldExpenses = 0
    let oldBuildingServices = 0
    let oldRoomServices = 0
    let oldDocuments = 0

    for (const building of legacyBuildings) {
        const rooms = Array.isArray(building.rooms) ? building.rooms : []
        const expenses = Array.isArray(building.expenses) ? building.expenses : []
        const buildingServices = Array.isArray(building.services) ? building.services : []

        oldRooms += rooms.length
        oldExpenses += expenses.length
        oldBuildingServices += buildingServices.length

        for (const room of rooms) {
            oldTenants += Array.isArray(room.tenants) ? room.tenants.length : 0
            oldReadings += Array.isArray(room.readings) ? room.readings.length : 0
            oldInvoices += Array.isArray(room.invoices) ? room.invoices.length : 0
            oldRoomServices += Array.isArray(room.services) ? room.services.length : 0
            oldDocuments += (Array.isArray(room.contracts) ? room.contracts.length : 0)
            oldDocuments += (Array.isArray(room.visaPhotos) ? room.visaPhotos.length : 0)
            oldDocuments += (Array.isArray(room.passportPhotos) ? room.passportPhotos.length : 0)
            oldDocuments += (Array.isArray(room.otherFiles) ? room.otherFiles.length : 0)
        }
    }

    const [
        newRooms,
        newStays,
        newTenants,
        newReadings,
        newInvoices,
        newPayments,
        newExpenses,
        newServices,
        newDocuments
    ] = await Promise.all([
        Room.countDocuments(),
        Stay.countDocuments(),
        Tenant.countDocuments(),
        MeterReading.countDocuments(),
        Invoice.countDocuments(),
        Payment.countDocuments(),
        Expense.countDocuments(),
        Service.countDocuments(),
        Document.countDocuments()
    ])

    console.log(JSON.stringify({
        legacy: {
            buildings: legacyBuildings.length,
            rooms: oldRooms,
            tenantsHistoricalEntries: oldTenants,
            readingsRaw: oldReadings,
            invoicesRaw: oldInvoices,
            expenses: oldExpenses,
            servicesBuildingLevel: oldBuildingServices,
            servicesRoomLevel: oldRoomServices,
            documents: oldDocuments
        },
        normalized: {
            rooms: newRooms,
            stays: newStays,
            uniqueTenants: newTenants,
            readingsDeduped: newReadings,
            invoices: newInvoices,
            payments: newPayments,
            expenses: newExpenses,
            services: newServices,
            documents: newDocuments
        }
    }, null, 2))

    await mongoose.disconnect()
}

run().catch(async (error) => {
    console.error('[verify] error:', error)
    try {
        await mongoose.disconnect()
    } catch {}
    process.exit(1)
})
