import { Types } from 'mongoose'
import Room from '../../models/Room'
import DocumentModel from '../../models/Document'
import Stay from '../../models/Stay'
import Tenant from '../../models/Tenant'
import {
    asTrimmedString,
    collectValidationErrors,
    requireString
} from '../common/validation'
import type { CreateDocumentInput } from './document.types'

function normalizeDocumentType(value: unknown): 'contract' | 'visa' | 'passport' | 'other' {
    const type = asTrimmedString(value).toLowerCase()

    if (type === 'contract') return 'contract'
    if (type === 'visa') return 'visa'
    if (type === 'passport') return 'passport'
    return 'other'
}

function normalizeDate(value: unknown): string {
    const raw = asTrimmedString(value)
    if (!raw) return new Date().toISOString().slice(0, 10)

    const date = new Date(raw)
    if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10)

    return date.toISOString().slice(0, 10)
}

export async function createDocumentForRoom(roomId: string, input: CreateDocumentInput) {
    if (!Types.ObjectId.isValid(roomId)) {
        return { status: 'room_not_found' as const }
    }

    const room = await Room.findById(roomId)
    if (!room) return { status: 'room_not_found' as const }

    const errors = collectValidationErrors([
        requireString(input.link, 'link')
    ])

    if (errors.length > 0) {
        return { status: 'invalid_link' as const }
    }

    const type = normalizeDocumentType(input.type)
    const date = normalizeDate(input.date)

    const activeStay = await Stay.findOne({
        roomId: room._id,
        status: 'active'
    }).sort({ rentalStartDate: -1 })

    const tenant = activeStay?.tenantId
        ? await Tenant.findById(activeStay.tenantId)
        : null

    const document = await DocumentModel.create({
        accountId: room.accountId ?? null,
        buildingId: room.buildingId,
        roomId: room._id,
        tenantId: tenant?._id ?? null,
        stayId: activeStay?._id ?? null,
        type,
        date,
        tenantNameSnapshot:
            asTrimmedString(input.tenantNameSnapshot) ||
            tenant?.fullName ||
            '',
        fileName: asTrimmedString(input.fileName),
        link: asTrimmedString(input.link),
        notes: asTrimmedString(input.notes),
        source: 'manual'
    })

    return { status: 'created' as const, document }
}

export async function deleteDocumentById(id: string) {
    if (!Types.ObjectId.isValid(id)) {
        return { status: 'document_not_found' as const }
    }

    const document = await DocumentModel.findById(id)
    if (!document) return { status: 'document_not_found' as const }

    await DocumentModel.deleteOne({ _id: id })

    return { status: 'deleted' as const }
}
