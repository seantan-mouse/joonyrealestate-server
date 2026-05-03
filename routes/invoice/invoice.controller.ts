import { Request, Response } from 'express'
import { createInvoiceForRoom } from './invoice.service'
import { logRouteError } from '../common/logger'

export async function createInvoiceForRoomHandler(req: Request, res: Response): Promise<void> {
    try {
        const result = await createInvoiceForRoom(req.params.id, req.body)

        if (result.status === 'room_not_found') {
            res.status(404).send('Room not found')
            return
        }

        if (result.status === 'duplicate_invoice') {
            res.status(409).send(
                result.duplicateReason === 'date'
                    ? 'An invoice already exists for this room and date'
                    : 'Invoice number already exists in this room'
            )
            return
        }

        if (result.status === 'validation_error') {
            res.status(400).json({ errors: result.errors })
            return
        }

        res.status(201).json(result.invoice)
    } catch (err) {
        logRouteError('POST /api/room/:id/invoices', err, {
            roomId: req.params.id,
            body: req.body
        })
        res.status(500).send('Internal server error')
    }
}
