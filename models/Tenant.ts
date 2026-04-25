import mongoose, { Document, Model, Schema, Types } from 'mongoose'

export type TenantGender = 'male' | 'female' | 'other' | ''
export type TenantLanguage = 'english' | 'khmer' | 'chinese' | 'japanese' | 'korean'
export type TenantCurrency = 'USD' | 'Riel'

export interface TenantAttrs {
    accountId?: Types.ObjectId
    fullName: string
    email?: string
    phone?: string
    businessSource?: string
    country?: string
    gender?: TenantGender
    language?: TenantLanguage
    currency?: TenantCurrency
    rentalTypeDefault?: string
    dateOfBirth?: string
    identityNo?: string
    passportExpiryDate?: string
    visaExpiryDate?: string
    address?: string
    notes?: string
    isActive?: boolean
    legacySource?: string
}

export interface TenantDoc extends Document {
    accountId?: Types.ObjectId
    fullName: string
    email: string
    phone: string
    businessSource: string
    country: string
    gender: TenantGender
    language: TenantLanguage
    currency: TenantCurrency
    rentalTypeDefault: string
    dateOfBirth: string
    identityNo: string
    passportExpiryDate: string
    visaExpiryDate: string
    address: string
    notes: string
    isActive: boolean
    legacySource: string
    createdAt: Date
    updatedAt: Date
}

const tenantSchema = new Schema<TenantDoc>(
    {
        accountId: {
            type: Schema.Types.ObjectId,
            ref: 'Account',
            index: true
        },
        fullName: {
            type: String,
            required: true,
            trim: true,
            index: true
        },
        email: {
            type: String,
            default: '',
            trim: true
        },
        phone: {
            type: String,
            default: '',
            trim: true,
            index: true
        },
        businessSource: {
            type: String,
            default: '',
            trim: true
        },
        country: {
            type: String,
            default: ''
        },
        gender: {
            type: String,
            enum: ['male', 'female', 'other', ''],
            default: ''
        },
        language: {
            type: String,
            enum: ['english', 'khmer', 'chinese', 'japanese', 'korean'],
            default: 'english'
        },
        currency: {
            type: String,
            enum: ['USD', 'Riel'],
            default: 'USD'
        },
        rentalTypeDefault: {
            type: String,
            default: ''
        },
        dateOfBirth: {
            type: String,
            default: ''
        },
        identityNo: {
            type: String,
            default: ''
        },
        passportExpiryDate: {
            type: String,
            default: ''
        },
        visaExpiryDate: {
            type: String,
            default: ''
        },
        address: {
            type: String,
            default: ''
        },
        notes: {
            type: String,
            default: ''
        },
        isActive: {
            type: Boolean,
            default: true
        },
        legacySource: {
            type: String,
            default: ''
        }
    },
    {
        timestamps: true,
        collection: 'tenants'
    }
)

const TenantModel: Model<TenantDoc> =
    mongoose.models.Tenant || mongoose.model<TenantDoc>('Tenant', tenantSchema)

export default TenantModel
