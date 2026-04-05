import { Request, Response } from 'express'
import {
    createExpenseForBuilding,
    deleteExpenseById,
    listExpensesByBuildingId,
    updateExpenseById
} from './expense.service'

export async function listExpensesForBuildingHandler(req: Request, res: Response): Promise<void> {
    try {
        const expenses = await listExpensesByBuildingId(req.params.buildingId)

        if (!expenses) {
            res.status(404).send('Building not found')
            return
        }

        res.json(expenses)
    } catch (err) {
        console.error(err)
        res.status(500).send('Internal server error')
    }
}

export async function createExpenseForBuildingHandler(req: Request, res: Response): Promise<void> {
    try {
        const result = await createExpenseForBuilding(req.params.buildingId, req.body)

        if (result.status === 'building_not_found') {
            res.status(404).send('Building not found')
            return
        }

        if (result.status === 'invalid_name') {
            res.status(400).send('Expense name is required')
            return
        }

        if (result.status === 'invalid_date') {
            res.status(400).send('Expense date is required')
            return
        }

        if (result.status === 'invalid_amount') {
            res.status(400).send('Expense amount must be greater than zero')
            return
        }

        res.status(201).json(result.expense)
    } catch (err) {
        console.error(err)
        res.status(500).send('Internal server error')
    }
}

export async function updateExpenseHandler(req: Request, res: Response): Promise<void> {
    try {
        const result = await updateExpenseById(req.params.id, req.body)

        if (result.status === 'expense_not_found') {
            res.status(404).send('Expense not found')
            return
        }

        if (result.status === 'invalid_name') {
            res.status(400).send('Expense name is required')
            return
        }

        if (result.status === 'invalid_date') {
            res.status(400).send('Expense date is required')
            return
        }

        if (result.status === 'invalid_amount') {
            res.status(400).send('Expense amount must be greater than zero')
            return
        }

        res.json(result.expense)
    } catch (err) {
        console.error(err)
        res.status(500).send('Internal server error')
    }
}

export async function deleteExpenseHandler(req: Request, res: Response): Promise<void> {
    try {
        const deleted = await deleteExpenseById(req.params.id)

        if (!deleted) {
            res.status(404).send('Expense not found')
            return
        }

        res.sendStatus(200)
    } catch (err) {
        console.error(err)
        res.status(500).send('Internal server error')
    }
}