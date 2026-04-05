import type { Request, Response } from 'express'
import { deleteReadingById } from './reading.delete.service'
import { logRouteError } from '../common/logger'

export async function deleteReadingHandler(req: Request, res: Response) {
    try {
        const result = await deleteReadingById(req.params.id)

        if (result.status === 'reading_not_found') {
            res.status(404).json({ error: 'Reading not found' })
            return
        }

        res.sendStatus(200)
    } catch (error) {
        logRouteError('deleteReadingHandler', error, {
            readingId: req.params.id
        })
        res.status(500).json({ error: 'Failed to delete reading' })
    }
}