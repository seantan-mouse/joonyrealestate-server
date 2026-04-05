import 'dotenv/config'
import fs from 'node:fs/promises'
import mongoose from 'mongoose'
import LegacyBuilding from '../models/LegacyBuilding'

async function importBuildings(): Promise<void> {
    if (process.env.MIGRATION_NUKE_OK !== 'YES') {
        throw new Error(
            'Refusing to delete staged legacy buildings. Set MIGRATION_NUKE_OK=YES in your env.'
        )
    }

    const mongoUri = process.env.MONGODB_URI

    if (!mongoUri) {
        throw new Error('MONGODB_URI is not set')
    }

    await mongoose.connect(mongoUri)
    console.log('[importBuildings] connected')

    try {
        const raw = await fs.readFile('data/buildings.json', 'utf8')
        const buildingsData = JSON.parse(raw) as unknown[]

        const del = await LegacyBuilding.deleteMany({})
        console.log(`[importBuildings] deleted staged legacy buildings: ${del.deletedCount}`)

        const batchSize = 200

        for (let i = 0; i < buildingsData.length; i += batchSize) {
            const batch = buildingsData.slice(i, i + batchSize)
            await LegacyBuilding.insertMany(batch, { ordered: false })
            console.log(
                `[importBuildings] staged batch ${Math.floor(i / batchSize) + 1} (${batch.length})`
            )
        }

        console.log('[importBuildings] staged legacy buildings successfully')
    } finally {
        await mongoose.disconnect()
    }
}

void importBuildings().catch((err: unknown) => {
    console.error('[importBuildings] error:', err)
    process.exit(1)
})
