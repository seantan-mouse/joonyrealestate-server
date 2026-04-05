import { Request, Response } from 'express'
import { createRoom, getRoomDetail, updateRoom } from './room.service'

export async function getRoomDetailHandler(req: Request, res: Response): Promise<void> {
    try {
        const result = await getRoomDetail(req.params.id)

        if (!result) {
            res.status(404).send('Room not found')
            return
        }

        res.json(result)
    } catch (err) {
        console.error(err)
        res.status(500).send('Internal server error')
    }
}

export async function createRoomHandler(req: Request, res: Response): Promise<void> {
    try {
        const result = await createRoom(req.params.buildingId, req.body)

        if (result.status === 'building_not_found') {
            res.status(404).send('Building not found')
            return
        }

        if (result.status === 'invalid_name') {
            res.status(400).send('Room name is required')
            return
        }

        if (result.status === 'duplicate_room') {
            res.status(409).send('Room name already exists in this building')
            return
        }

        res.status(201).json(result.room)
    } catch (err) {
        console.error(err)
        res.status(500).send('Internal server error')
    }
}

export async function updateRoomHandler(req: Request, res: Response): Promise<void> {
    try {
        const result = await updateRoom(req.params.id, req.body)

        if (result.status === 'room_not_found') {
            res.status(404).send('Room not found')
            return
        }

        if (result.status === 'invalid_name') {
            res.status(400).send('Room name is required')
            return
        }

        if (result.status === 'duplicate_room') {
            res.status(409).send('Room name already exists in this building')
            return
        }

        res.json(result.room)
    } catch (err) {
        console.error(err)
        res.status(500).send('Internal server error')
    }
}