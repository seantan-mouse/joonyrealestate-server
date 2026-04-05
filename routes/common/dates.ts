import dayjs, { type Dayjs } from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'

dayjs.extend(customParseFormat)

const DATE_FORMATS = [
    'YYYY-MM-DD',
    'D MMM YYYY',
    'DD MMM YYYY',
    'YYYY/MM/DD',
    'D/M/YYYY',
    'DD/MM/YYYY'
]

export function parseStoredDate(value?: string): Dayjs | null {
    const raw = String(value ?? '').trim()
    if (!raw) return null

    for (const format of DATE_FORMATS) {
        const parsed = dayjs(raw, format, true)
        if (parsed.isValid()) {
            return parsed.startOf('day')
        }
    }

    const fallback = dayjs(raw)
    return fallback.isValid() ? fallback.startOf('day') : null
}

export function toCanonicalIsoDate(value?: string): string {
    return parseStoredDate(value)?.format('YYYY-MM-DD') ?? ''
}

export function toDisplayDate(value?: string): string {
    return parseStoredDate(value)?.format('D MMM YYYY') ?? ''
}

export function compareStoredDateAsc(left?: string, right?: string): number {
    const leftTime = parseStoredDate(left)?.valueOf() ?? 0
    const rightTime = parseStoredDate(right)?.valueOf() ?? 0

    if (leftTime === rightTime) {
        return String(left ?? '').localeCompare(String(right ?? ''))
    }

    return leftTime - rightTime
}

export function compareStoredDateDesc(left?: string, right?: string): number {
    return compareStoredDateAsc(right, left)
}

export function getTodayIsoDate(): string {
    return dayjs().format('YYYY-MM-DD')
}
