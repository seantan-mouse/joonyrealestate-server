import type { Request, Response } from 'express'
import { createServiceForRoom, deleteServiceById } from './service.service'
import { logRouteError } from '../common/logger'

export async function createServiceForRoomHandler(req: Request, res: Response) {
    try {
        const result = await createServiceForRoom(req.params.id, req.body)

        if (result.status === 'room_not_found') {
            res.status(404).json({ error: 'Room not found' })
            return
        }

        if (result.status === 'invalid_name') {
            res.status(400).json({ error: 'Service name is required' })
            return
        }

        res.status(201).json(result.service)
    } catch (error) {
        logRouteError('createServiceForRoomHandler', error, {
            roomId: req.params.id,
            body: req.body
        })
        res.status(500).json({ error: 'Failed to create service' })
    }
}

export async function deleteServiceHandler(req: Request, res: Response) {
    try {
        const result = await deleteServiceById(req.params.id)

        if (result.status === 'service_not_found') {
            res.status(404).json({ error: 'Service not found' })
            return
        }

        res.sendStatus(200)
    } catch (error) {
        logRouteError('deleteServiceHandler', error, {
            serviceId: req.params.id
        })
        res.status(500).json({ error: 'Failed to delete service' })
    }
}