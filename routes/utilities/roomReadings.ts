// apps/server/src/routes/utilities/roomReadings.ts

type AnyObj = Record<string, any>

const normalizeDateKey = (v: any): string => String(v ?? '').trim()

const toNumber = (v: any): number => {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
}

/**
 * Merge two readings arrays without losing data.
 * - De-dupe by `date` (string key)
 * - Prefer `incoming` values when same date exists
 */
export const mergeReadings = (existing: any[] | undefined, incoming: any[] | undefined): any[] => {
    const base = Array.isArray(existing) ? existing : []
    const next = Array.isArray(incoming) ? incoming : []

    const map = new Map<string, AnyObj>()

    for (const r of base) {
        const k = normalizeDateKey(r?.date)
        if (!k) continue
        map.set(k, { ...r, date: k })
    }

    for (const r of next) {
        const k = normalizeDateKey(r?.date)
        if (!k) continue
        const prev = map.get(k) ?? {}
        map.set(k, { ...prev, ...r, date: k })
    }

    return Array.from(map.values())
}

/**
 * Upsert a reading entry derived from an invoice.
 * - date key is invoice.date (e.g. "1 Aug 2025")
 * - electricity/water are invoice.electricityReading / invoice.waterReading
 */
export const upsertReadingFromInvoice = (readings: any[] | undefined, invoice: AnyObj): any[] => {
    const dateKey = normalizeDateKey(invoice?.date)
    if (!dateKey) return Array.isArray(readings) ? readings : []

    const electricity = toNumber(invoice?.electricityReading)
    const water = toNumber(invoice?.waterReading)

    const arr = Array.isArray(readings) ? [...readings] : []

    const idx = arr.findIndex(r => normalizeDateKey(r?.date) === dateKey)
    const next = { date: dateKey, electricity, water }

    if (idx >= 0) {
        arr[idx] = { ...arr[idx], ...next }
        return arr
    }

    return [next, ...arr]
}

/**
 * Ensures:
 * - readings are preserved/merged
 * - every invoice produces a reading upsert
 */
export const normalizeRoomReadingsFromInvoices = (room: AnyObj, existingRoom?: AnyObj): AnyObj => {
    const mergedReadings = mergeReadings(existingRoom?.readings, room?.readings)

    const invoices = Array.isArray(room?.invoices) ? room.invoices : []
    let outReadings = mergedReadings

    for (const inv of invoices) {
        outReadings = upsertReadingFromInvoice(outReadings, inv)
    }

    return {
        ...room,
        readings: outReadings
    }
}