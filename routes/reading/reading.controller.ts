import { Request, Response } from 'express'
import { createReadingForRoom } from './reading.service'

export async function createReadingForRoomHandler(req: Request, res: Response): Promise<void> {
    try {
        const result = await createReadingForRoom(req.params.id, req.body)

        if (result.status === 'room_not_found') {
            res.status(404).send('Room not found')
            return
        }

        if (result.status === 'invalid_reading_date') {
            res.status(400).send('Reading date is required')
            return
        }

        if (result.status === 'duplicate_reading_date') {
            res.status(409).send('A reading for this room and date already exists')
            return
        }

        res.status(201).json(result.reading)
    } catch (err) {
        console.error(err)
        res.status(500).send('Internal server error')
    }
}