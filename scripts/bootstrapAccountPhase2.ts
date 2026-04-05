import mongoose, { Types } from 'mongoose'
import keys from '../config/keys'
import Account from '../models/Account'
import Building from '../models/Building'
import Room from '../models/Room'
import Tenant from '../models/Tenant'
import Stay from '../models/Stay'
import Invoice from '../models/Invoice'
import Payment from '../models/Payment'
import Expense from '../models/Expense'
import Service from '../models/Service'
import DocumentModel from '../models/Document'
import MeterReading from '../models/MeterReading'

type IdLike = Types.ObjectId | string | null | undefined

function toIdString(value: IdLike): string {
    if (value instanceof Types.ObjectId) return value.toString()
    return String(value ?? '').trim()
}

async function runUpdate(args: {
    label: string
    update: () => Promise<{ matchedCount?: number; modifiedCount?: number }>
}) {
    const result = await args.update()

    return {
        label: args.label,
        matchedCount: Number(result.matchedCount ?? 0),
        modifiedCount: Number(result.modifiedCount ?? 0)
    }
}

async function run() {
    const accountSlug = String(process.env.ACCOUNT_SLUG ?? 'dneth').trim().toLowerCase()

    await mongoose.connect(keys.mongoURI)

    const account = await Account.findOne({ slug: accountSlug }).select('_id slug name').lean<{
        _id: Types.ObjectId
        slug: string
        name: string
    } | null>()

    if (!account) {
        throw new Error(`Account ${accountSlug} not found. Run Phase 1 bootstrap first.`)
    }

    const buildings = await Building.find({ accountId: account._id })
        .select('_id accountId')
        .lean<Array<{ _id: Types.ObjectId; accountId?: Types.ObjectId }>>()

    const buildingAccountById = new Map<string, Types.ObjectId>(
        buildings
            .filter((building) => building.accountId instanceof Types.ObjectId)
            .map((building) => [toIdString(building._id), building.accountId as Types.ObjectId])
    )

    const rooms = await Room.find({
        buildingId: { $in: buildings.map((building) => building._id) }
    })
        .select('_id buildingId accountId')
        .lean<Array<{ _id: Types.ObjectId; buildingId: Types.ObjectId; accountId?: Types.ObjectId }>>()

    const roomAccountById = new Map<string, Types.ObjectId>()

    for (const room of rooms) {
        const accountId = room.accountId ?? buildingAccountById.get(toIdString(room.buildingId))
        if (accountId) {
            roomAccountById.set(toIdString(room._id), accountId)
        }
    }

    const stays = await Stay.find({
        buildingId: { $in: buildings.map((building) => building._id) }
    })
        .select('_id buildingId roomId tenantId accountId')
        .lean<Array<{
            _id: Types.ObjectId
            buildingId: Types.ObjectId
            roomId: Types.ObjectId
            tenantId: Types.ObjectId
            accountId?: Types.ObjectId
        }>>()

    const stayAccountById = new Map<string, Types.ObjectId>()
    const tenantAccountById = new Map<string, Types.ObjectId>()

    for (const stay of stays) {
        const accountId =
            stay.accountId ??
            roomAccountById.get(toIdString(stay.roomId)) ??
            buildingAccountById.get(toIdString(stay.buildingId))

        if (!accountId) continue

        stayAccountById.set(toIdString(stay._id), accountId)
        tenantAccountById.set(toIdString(stay.tenantId), accountId)
    }

    const invoices = await Invoice.find({
        buildingId: { $in: buildings.map((building) => building._id) }
    })
        .select('_id buildingId roomId stayId tenantId accountId')
        .lean<Array<{
            _id: Types.ObjectId
            buildingId: Types.ObjectId
            roomId: Types.ObjectId
            stayId?: Types.ObjectId | null
            tenantId?: Types.ObjectId | null
            accountId?: Types.ObjectId
        }>>()

    const invoiceAccountById = new Map<string, Types.ObjectId>()

    for (const invoice of invoices) {
        const accountId =
            invoice.accountId ??
            (invoice.stayId ? stayAccountById.get(toIdString(invoice.stayId)) : undefined) ??
            roomAccountById.get(toIdString(invoice.roomId)) ??
            buildingAccountById.get(toIdString(invoice.buildingId)) ??
            (invoice.tenantId ? tenantAccountById.get(toIdString(invoice.tenantId)) : undefined)

        if (!accountId) continue

        invoiceAccountById.set(toIdString(invoice._id), accountId)

        if (invoice.tenantId) {
            tenantAccountById.set(toIdString(invoice.tenantId), accountId)
        }
    }

    const documentDocs = await DocumentModel.find({
        $or: [
            { buildingId: { $in: buildings.map((building) => building._id) } },
            { roomId: { $in: rooms.map((room) => room._id) } },
            { stayId: { $in: stays.map((stay) => stay._id) } }
        ]
    })
        .select('_id buildingId roomId stayId tenantId accountId')
        .lean<Array<{
            _id: Types.ObjectId
            buildingId?: Types.ObjectId | null
            roomId?: Types.ObjectId | null
            stayId?: Types.ObjectId | null
            tenantId?: Types.ObjectId | null
            accountId?: Types.ObjectId | null
        }>>()

    const reports = await Promise.all([
        runUpdate({
            label: 'rooms',
            update: async () =>
                Room.updateMany(
                    {
                        buildingId: { $in: buildings.map((building) => building._id) },
                        $or: [{ accountId: { $exists: false } }, { accountId: null }]
                    },
                    [
                        {
                            $set: {
                                accountId: account._id
                            }
                        }
                    ]
                )
        }),
        runUpdate({
            label: 'tenants',
            update: async () =>
                Tenant.updateMany(
                    {
                        _id: {
                            $in: Array.from(tenantAccountById.keys())
                                .filter((id) => Types.ObjectId.isValid(id))
                                .map((id) => new Types.ObjectId(id))
                        },
                        $or: [{ accountId: { $exists: false } }, { accountId: null }]
                    },
                    { $set: { accountId: account._id } }
                )
        }),
        runUpdate({
            label: 'stays',
            update: async () =>
                Stay.updateMany(
                    {
                        buildingId: { $in: buildings.map((building) => building._id) },
                        $or: [{ accountId: { $exists: false } }, { accountId: null }]
                    },
                    { $set: { accountId: account._id } }
                )
        }),
        runUpdate({
            label: 'invoices',
            update: async () =>
                Invoice.updateMany(
                    {
                        buildingId: { $in: buildings.map((building) => building._id) },
                        $or: [{ accountId: { $exists: false } }, { accountId: null }]
                    },
                    { $set: { accountId: account._id } }
                )
        }),
        runUpdate({
            label: 'payments',
            update: async () =>
                Payment.updateMany(
                    {
                        invoiceId: {
                            $in: Array.from(invoiceAccountById.keys())
                                .filter((id) => Types.ObjectId.isValid(id))
                                .map((id) => new Types.ObjectId(id))
                        },
                        $or: [{ accountId: { $exists: false } }, { accountId: null }]
                    },
                    { $set: { accountId: account._id } }
                )
        }),
        runUpdate({
            label: 'expenses',
            update: async () =>
                Expense.updateMany(
                    {
                        buildingId: { $in: buildings.map((building) => building._id) },
                        $or: [{ accountId: { $exists: false } }, { accountId: null }]
                    },
                    { $set: { accountId: account._id } }
                )
        }),
        runUpdate({
            label: 'services',
            update: async () =>
                Service.updateMany(
                    {
                        buildingId: { $in: buildings.map((building) => building._id) },
                        $or: [{ accountId: { $exists: false } }, { accountId: null }]
                    },
                    { $set: { accountId: account._id } }
                )
        }),
        runUpdate({
            label: 'documents',
            update: async () =>
                DocumentModel.updateMany(
                    {
                        _id: { $in: documentDocs.map((doc) => doc._id) },
                        $or: [{ accountId: { $exists: false } }, { accountId: null }]
                    },
                    { $set: { accountId: account._id } }
                )
        }),
        runUpdate({
            label: 'meterreadings',
            update: async () =>
                MeterReading.updateMany(
                    {
                        buildingId: { $in: buildings.map((building) => building._id) },
                        $or: [{ accountId: { $exists: false } }, { accountId: null }]
                    },
                    { $set: { accountId: account._id } }
                )
        })
    ])

    console.log(JSON.stringify({
        account: {
            id: toIdString(account._id),
            slug: account.slug,
            name: account.name
        },
        collections: reports
    }, null, 2))

    await mongoose.disconnect()
}

run().catch(async (error) => {
    console.error('bootstrapAccountPhase2 failed', error)

    try {
        await mongoose.disconnect()
    } catch {}

    process.exit(1)
})
