import mongoose from 'mongoose'
import keys from '../config/keys'
import Account from '../models/Account'
import Building from '../models/Building'
import User from '../models/User'

type BootstrapConfig = {
    name: string
    slug: string
    customDomains: string[]
}

function getBootstrapConfig(): BootstrapConfig {
    const name = String(process.env.ACCOUNT_NAME ?? 'Dneth Apartment').trim()
    const slug = String(process.env.ACCOUNT_SLUG ?? 'dneth').trim().toLowerCase()
    const customDomains = String(
        process.env.ACCOUNT_CUSTOM_DOMAINS ?? 'dnethmanagement.com,www.dnethmanagement.com'
    )
        .split(',')
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean)

    return {
        name,
        slug,
        customDomains
    }
}

async function run() {
    const config = getBootstrapConfig()

    await mongoose.connect(keys.mongoURI)

    const account = await Account.findOneAndUpdate(
        { slug: config.slug },
        {
            $set: {
                name: config.name,
                slug: config.slug,
                customDomains: config.customDomains,
                status: 'active'
            },
            $setOnInsert: {
                createdAt: new Date()
            }
        },
        {
            upsert: true,
            new: true
        }
    )

    const [usersResult, buildingsResult] = await Promise.all([
        User.updateMany(
            {
                $or: [
                    { accountId: { $exists: false } },
                    { accountId: null }
                ]
            },
            { $set: { accountId: account._id } }
        ),
        Building.updateMany(
            {
                $or: [
                    { accountId: { $exists: false } },
                    { accountId: null }
                ]
            },
            { $set: { accountId: account._id } }
        )
    ])

    console.log(JSON.stringify({
        account: {
            id: String(account._id),
            name: account.name,
            slug: account.slug,
            customDomains: account.customDomains
        },
        backfill: {
            usersMatched: usersResult.matchedCount,
            usersModified: usersResult.modifiedCount,
            buildingsMatched: buildingsResult.matchedCount,
            buildingsModified: buildingsResult.modifiedCount
        }
    }, null, 2))

    await mongoose.disconnect()
}

run().catch(async (error) => {
    console.error('bootstrapAccountPhase1 failed', error)

    try {
        await mongoose.disconnect()
    } catch {}

    process.exit(1)
})
