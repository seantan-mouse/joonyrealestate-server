import type { Request, Response } from 'express'
import { createDocumentForRoom, deleteDocumentById } from './document.service'
import { logRouteError } from '../common/logger'

export async function createDocumentForRoomHandler(req: Request, res: Response) {
    try {
        const result = await createDocumentForRoom(req.params.id, req.body)

        if (result.status === 'room_not_found') {
            res.status(404).json({ error: 'Room not found' })
            return
        }

        if (result.status === 'invalid_link') {
            res.status(400).json({ error: 'Document link is required' })
            return
        }

        res.status(201).json(result.document)
    } catch (error) {
        logRouteError('createDocumentForRoomHandler', error, {
            roomId: req.params.id,
            body: req.body
        })
        res.status(500).json({ error: 'Failed to create document' })
    }
}

export async function deleteDocumentHandler(req: Request, res: Response) {
    try {
        const result = await deleteDocumentById(req.params.id)

        if (result.status === 'document_not_found') {
            res.status(404).json({ error: 'Document not found' })
            return
        }

        res.sendStatus(200)
    } catch (error) {
        logRouteError('deleteDocumentHandler', error, {
            documentId: req.params.id
        })
        res.status(500).json({ error: 'Failed to delete document' })
    }
}