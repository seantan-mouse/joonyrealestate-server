import { Request, Response } from 'express'
import type { AuthenticatedRequest } from '../middleware/authenticate'
import { createStayForRoom, checkoutStayForRoom, updateStayForRoom } from './stay.service'

export async function createStayForRoomHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
        const result = await createStayForRoom(req.params.id, req.body, req.account?.id)

        if (result.status === 'room_not_found') {
            res.status(404).send('Room not found')
            return
        }

        if (result.status === 'building_not_found') {
            res.status(404).send('Building not found')
            return
        }

        if (result.status === 'invalid_tenant_name') {
            res.status(400).send('Tenant full name is required')
            return
        }

        if (result.status === 'invalid_rental_start_date') {
            res.status(400).send('Rental start date is required')
            return
        }

        res.status(201).json({
            tenant: result.tenant,
            stay: result.stay,
            room: result.room
        })
    } catch (err) {
        console.error(err)
        res.status(500).send('Internal server error')
    }
}

export async function checkoutStayForRoomHandler(req: Request, res: Response): Promise<void> {
    try {
        const result = await checkoutStayForRoom(req.params.id, req.body)

        if (result.status === 'room_not_found') {
            res.status(404).send('Room not found')
            return
        }

        if (result.status === 'active_stay_not_found') {
            res.status(404).send('No active stay found for this room')
            return
        }

        res.status(200).json({
            stay: result.stay,
            room: result.room
        })
    } catch (err) {
        console.error(err)
        res.status(500).send('Internal server error')
    }
}

export async function updateStayForRoomHandler(req: Request, res: Response): Promise<void> {
    try {
        const result = await updateStayForRoom(req.params.id, req.params.stayId, req.body)

        if (result.status === 'room_not_found') {
            res.status(404).send('Room not found')
            return
        }

        if (result.status === 'stay_not_found') {
            res.status(404).send('Stay not found')
            return
        }

        if (result.status === 'tenant_not_found') {
            res.status(404).send('Tenant not found')
            return
        }

        if (result.status === 'invalid_tenant_name') {
            res.status(400).send('Tenant full name is required')
            return
        }

        if (result.status === 'invalid_rental_start_date') {
            res.status(400).send('Rental start date is required')
            return
        }

        res.status(200).json({
            tenant: result.tenant,
            stay: result.stay,
            room: result.room
        })
    } catch (err) {
        console.error(err)
        res.status(500).send('Internal server error')
    }
}
