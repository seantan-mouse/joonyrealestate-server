import mongoose, { Document, Model, Schema } from 'mongoose'

export type AccountStatus = 'active' | 'inactive'

export interface AccountAttrs {
    name: string
    slug: string
    customDomains?: string[]
    status?: AccountStatus
    createdAt?: Date
    createdBy?: string
    settings?: {
        defaultLanguage?: string
        defaultCurrency?: string
        timezone?: string
        showLanguageSelector?: boolean
    }
}

export interface AccountDoc extends Document {
    name: string
    slug: string
    customDomains: string[]
    status: AccountStatus
    createdAt?: Date
    createdBy?: string
    settings: {
        defaultLanguage?: string
        defaultCurrency?: string
        timezone?: string
        showLanguageSelector?: boolean
    }
}

function normalizeDomainList(value: unknown): string[] {
    if (!Array.isArray(value)) return []

    return value
        .map((item) => String(item ?? '').trim().toLowerCase())
        .filter(Boolean)
}

const accountSchema = new Schema<AccountDoc>(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },
        slug: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
            index: true,
            unique: true
        },
        customDomains: {
            type: [String],
            default: []
        },
        status: {
            type: String,
            default: 'active',
            enum: ['active', 'inactive']
        },
        createdAt: Date,
        createdBy: String,
        settings: {
            defaultLanguage: String,
            defaultCurrency: String,
            timezone: String,
            showLanguageSelector: {
                type: Boolean,
                default: true
            }
        }
    },
    {
        collection: 'accounts'
    }
)

accountSchema.pre('save', function (next) {
    const account = this as AccountDoc
    account.slug = String(account.slug ?? '').trim().toLowerCase()
    account.customDomains = normalizeDomainList(account.customDomains)
    next()
})

accountSchema.index({ customDomains: 1 })

const AccountModel: Model<AccountDoc> =
    mongoose.models.Account || mongoose.model<AccountDoc>('Account', accountSchema)

export default AccountModel
