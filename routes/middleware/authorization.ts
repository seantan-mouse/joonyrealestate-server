import type { NextFunction, Response } from 'express'
import { Types } from 'mongoose'
import Building from '../../models/Building'
import DocumentModel from '../../models/Document'
import Expense from '../../models/Expense'
import Invoice from '../../models/Invoice'
import MeterReading from '../../models/MeterReading'
import Room from '../../models/Room'
import Service from '../../models/Service'
import type { AuthenticatedRequest } from './authenticate'
import { getUserAccessToBuildings, normalizeUserRoleLower } from '../common/user'

type Middleware = (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
) => void | Promise<void>

function isAdminRequest(req: AuthenticatedRequest): boolean {
    return normalizeUserRoleLower(req.user?.role).includes('admin')
}

function canAccessBuilding(req: AuthenticatedRequest, buildingId: string): boolean {
    if (isAdminRequest(req)) {
        return true
    }

    return getUserAccessToBuildings(req.user).includes(buildingId)
}

function getAccountObjectId(req: AuthenticatedRequest): Types.ObjectId | null {
    const raw = String(req.account?.id ?? '').trim()
    if (!Types.ObjectId.isValid(raw)) return null
    return new Types.ObjectId(raw)
}

function sendForbidden(res: Response) {
    res.status(403).json({ error: 'Forbidden' })
}

function sendNotFound(res: Response) {
    res.status(404).json({ error: 'Not found' })
}

async function enforceResolvedBuildingAccess(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
    resolver: () => Promise<string | null>
) {
    try {
        const buildingId = await resolver()
        const accountId = getAccountObjectId(req)

        if (!buildingId || !accountId) {
            sendNotFound(res)
            return
        }

        const building = await Building.findOne({ _id: buildingId, accountId }).select('_id')

        if (!building?._id) {
            sendNotFound(res)
            return
        }

        if (!canAccessBuilding(req, buildingId)) {
            sendForbidden(res)
            return
        }

        next()
    } catch (error) {
        console.error('authorization middleware failed', error)
        res.status(500).json({ error: 'Internal server error' })
    }
}

async function findRoomByReference(roomId: string) {
    if (Types.ObjectId.isValid(roomId)) {
        const room = await Room.findById(roomId).select('buildingId')
        if (room?.buildingId) {
            return String(room.buildingId)
        }
    }

    const room = await Room.findOne({ legacyRoomId: roomId }).select('buildingId')
    return room?.buildingId ? String(room.buildingId) : null
}

export const requireAdmin: Middleware = (req, res, next) => {
    if (!isAdminRequest(req)) {
        sendForbidden(res)
        return
    }

    next()
}

export function requireSelfOrAdmin(paramName: string): Middleware {
    return (req, res, next) => {
        if (isAdminRequest(req)) {
            next()
            return
        }

        if (String(req.user?._id ?? '') === String(req.params[paramName] ?? '')) {
            next()
            return
        }

        sendForbidden(res)
    }
}

export function requireBuildingAccessFromBuildingParam(paramName: string): Middleware {
    return (req, res, next) =>
        enforceResolvedBuildingAccess(req, res, next, async () => {
            const rawId = String(req.params[paramName] ?? '').trim()
            const accountId = getAccountObjectId(req)

            if (!Types.ObjectId.isValid(rawId) || !accountId) {
                return null
            }

            const building = await Building.findOne({
                _id: rawId,
                accountId
            }).select('_id')
            return building?._id ? String(building._id) : null
        })
}

export function requireBuildingAccessFromRoomParam(paramName: string): Middleware {
    return (req, res, next) =>
        enforceResolvedBuildingAccess(req, res, next, async () => {
            const rawId = String(req.params[paramName] ?? '').trim()
            if (!rawId) {
                return null
            }

            return findRoomByReference(rawId)
        })
}

export function requireBuildingAccessFromInvoiceParam(paramName: string): Middleware {
    return (req, res, next) =>
        enforceResolvedBuildingAccess(req, res, next, async () => {
            const rawId = String(req.params[paramName] ?? '').trim()
            if (!Types.ObjectId.isValid(rawId)) {
                return null
            }

            const invoice = await Invoice.findById(rawId).select('buildingId')
            return invoice?.buildingId ? String(invoice.buildingId) : null
        })
}

export function requireBuildingAccessFromExpenseParam(paramName: string): Middleware {
    return (req, res, next) =>
        enforceResolvedBuildingAccess(req, res, next, async () => {
            const rawId = String(req.params[paramName] ?? '').trim()
            if (!Types.ObjectId.isValid(rawId)) {
                return null
            }

            const expense = await Expense.findById(rawId).select('buildingId')
            return expense?.buildingId ? String(expense.buildingId) : null
        })
}

export function requireBuildingAccessFromReadingParam(paramName: string): Middleware {
    return (req, res, next) =>
        enforceResolvedBuildingAccess(req, res, next, async () => {
            const rawId = String(req.params[paramName] ?? '').trim()
            if (!Types.ObjectId.isValid(rawId)) {
                return null
            }

            const reading = await MeterReading.findById(rawId).select('buildingId')
            return reading?.buildingId ? String(reading.buildingId) : null
        })
}

export function requireBuildingAccessFromServiceParam(paramName: string): Middleware {
    return (req, res, next) =>
        enforceResolvedBuildingAccess(req, res, next, async () => {
            const rawId = String(req.params[paramName] ?? '').trim()
            if (!Types.ObjectId.isValid(rawId)) {
                return null
            }

            const service = await Service.findById(rawId).select('buildingId')
            return service?.buildingId ? String(service.buildingId) : null
        })
}

export function requireBuildingAccessFromDocumentParam(paramName: string): Middleware {
    return (req, res, next) =>
        enforceResolvedBuildingAccess(req, res, next, async () => {
            const rawId = String(req.params[paramName] ?? '').trim()
            if (!Types.ObjectId.isValid(rawId)) {
                return null
            }

            const document = await DocumentModel.findById(rawId).select('buildingId roomId')
            if (document?.buildingId) {
                return String(document.buildingId)
            }

            if (document?.roomId) {
                return findRoomByReference(String(document.roomId))
            }

            return null
        })
}
