import { Types } from 'mongoose'

export function toObjectIdString(value: string | number | boolean | Types.ObjectId | null | undefined): string {
    if (value instanceof Types.ObjectId) return value.toString()
    return String(value ?? '')
}

export function compareDateAsc(a?: string, b?: string): number {
    return String(a ?? '').localeCompare(String(b ?? ''))
}

export function compareDateDesc(a?: string, b?: string): number {
    return compareDateAsc(b, a)
}

export function normalizeRoomStatus(value?: string): 'Vacant' | 'Occupied' | 'Reserved' | 'Maintenance' {
    if (value === 'Occupied' || value === 'Reserved' || value === 'Maintenance') return value
    return 'Vacant'
}

export function normalizeStayType(value?: string): 'monthly' | 'daily' | 'contract' {
    if (value === 'daily' || value === 'contract') return value
    return 'monthly'
}

export function normalizeLanguage(value?: string): 'english' | 'khmer' | 'chinese' | 'japanese' | 'korean' {
    if (value === 'khmer' || value === 'chinese' || value === 'japanese' || value === 'korean') return value
    return 'english'
}

export function normalizeCurrency(value?: string): 'USD' | 'Riel' {
    return value === 'Riel' ? 'Riel' : 'USD'
}

export function normalizeGender(value?: string): 'male' | 'female' | 'other' | '' {
    if (value === 'male' || value === 'female' || value === 'other') return value
    return ''
}

export function toNumber(value: unknown, fallback = 0): number {
    const num = Number(value)
    return Number.isFinite(num) ? num : fallback
}

export function toNullableNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null
    const num = Number(value)
    return Number.isFinite(num) ? num : null
}

export function toStringValue(value: unknown): string {
    if (value === null || value === undefined) return ''
    return String(value).trim()
}