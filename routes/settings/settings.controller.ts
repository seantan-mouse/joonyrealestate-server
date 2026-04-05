import { Request, Response } from 'express'
import AppSettings from '../../models/AppSettings'

export async function getSettings(_req: Request, res: Response): Promise<void> {
    try {
        let settings = await AppSettings.findOne()

        if (!settings) {
            settings = await AppSettings.create({
                exchangeRateUSDToRiel: 4000
            })
        }

        res.json(settings)
    } catch (error) {
        console.error(error)
        res.status(500).json({ error: 'Server error' })
    }
}

export async function updateSettings(req: Request, res: Response): Promise<void> {
    try {
        const { exchangeRateUSDToRiel } = req.body

        if (typeof exchangeRateUSDToRiel !== 'number' || exchangeRateUSDToRiel <= 0) {
            res.status(400).json({ error: 'Exchange rate must be a positive number' })
            return
        }

        const settings = await AppSettings.findOneAndUpdate(
            {},
            { exchangeRateUSDToRiel },
            { new: true, upsert: true }
        )

        res.json(settings)
    } catch (error) {
        console.error(error)
        res.status(500).json({ error: 'Server error' })
    }
}