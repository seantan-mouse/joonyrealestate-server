require('dotenv').config()
const sql = require('mssql')
const fs = require('fs').promises
const path = require('path')

const TABLES = [
    'dbo.Contract',
    'dbo.Customer',
    'dbo.CustomerContract',
    'dbo.DocumentFile',
    'dbo.Expense',
    'dbo.Location',
    'dbo.ReceiptDetails',
    'dbo.ReceiptHeader',
    'dbo.RentalServices',
    'dbo.Room',
    'dbo.Service',
    'dbo.[User]'
]

const safeName = (t) => t.replace('.', '_').replace(/[\[\]]/g, '')

async function exportSqlData() {
    const outDir = path.join('data', 'sql')
    await fs.mkdir(outDir, { recursive: true })

    const pool = await sql.connect({
        user: process.env.SQL_USER,
        password: process.env.SQL_PASSWORD,
        server: process.env.SQL_SERVER,
        database: process.env.SQL_DATABASE,
        options: { encrypt: true, trustServerCertificate: true }
    })

    try {
        for (const table of TABLES) {
            const result = await pool.request().query(`SELECT * FROM ${table}`)
            const rows = result.recordset || []

            if (table.toLowerCase().includes('documentfile')) {
                for (const r of rows) {
                    if (r.FileData && Buffer.isBuffer(r.FileData)) {
                        r.FileData = r.FileData.toString('base64')
                    }
                }
            }

            const file = path.join(outDir, `${safeName(table)}.json`)
            await fs.writeFile(file, JSON.stringify(rows, null, 2))
            console.log(`[export] ${table} -> ${file} (${rows.length})`)
        }
    } finally {
        await pool.close()
    }
}

exportSqlData().catch((err) => {
    console.error('[export] error:', err)
    process.exit(1)
})