export type CreatePaymentInput = {
    paymentDate?: string
    amount?: number
    type?: 'full' | 'partial'
    method?: 'cash' | 'bank' | 'khqr' | 'card' | 'other'
    notes?: string
}