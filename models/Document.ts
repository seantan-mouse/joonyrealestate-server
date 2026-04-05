import mongoose, { Document, Model, Schema, Types } from 'mongoose'

export type DocumentType = 'contract' | 'visa' | 'passport' | 'other'

export interface StoredDocumentAttrs {
    accountId?: Types.ObjectId | null
    buildingId?: Types.ObjectId | null
    roomId?: Types.ObjectId | null
    tenantId?: Types.ObjectId | null
    stayId?: Types.ObjectId | null
    type: DocumentType
    date: string
    tenantNameSnapshot?: string
    fileName?: string
    link: string
    notes?: string
    source?: string
}

export interface StoredDocumentDoc extends Document {
    accountId: Types.ObjectId | null
    buildingId: Types.ObjectId | null
    roomId: Types.ObjectId | null
    tenantId: Types.ObjectId | null
    stayId: Types.ObjectId | null
    type: DocumentType
    date: string
    tenantNameSnapshot: string
    fileName: string
    link: string
    notes: string
    source: string
    createdAt: Date
    updatedAt: Date
}

const documentSchema = new Schema<StoredDocumentDoc>(
    {
        accountId: {
            type: Schema.Types.ObjectId,
            ref: 'Account',
            default: null,
            index: true
        },
        buildingId: {
            type: Schema.Types.ObjectId,
            ref: 'Building',
            default: null,
            index: true
        },
        roomId: {
            type: Schema.Types.ObjectId,
            ref: 'Room',
            default: null,
            index: true
        },
        tenantId: {
            type: Schema.Types.ObjectId,
            ref: 'Tenant',
            default: null,
            index: true
        },
        stayId: {
            type: Schema.Types.ObjectId,
            ref: 'Stay',
            default: null,
            index: true
        },
        type: {
            type: String,
            enum: ['contract', 'visa', 'passport', 'other'],
            required: true,
            index: true
        },
        date: {
            type: String,
            required: true,
            default: ''
        },
        tenantNameSnapshot: {
            type: String,
            default: ''
        },
        fileName: {
            type: String,
            default: ''
        },
        link: {
            type: String,
            required: true
        },
        notes: {
            type: String,
            default: ''
        },
        source: {
            type: String,
            default: 'migration'
        }
    },
    {
        timestamps: true,
        collection: 'documents'
    }
)

documentSchema.index({ roomId: 1, type: 1, date: 1 })

const DocumentModel: Model<StoredDocumentDoc> =
    mongoose.models.Document || mongoose.model<StoredDocumentDoc>('Document', documentSchema)

export default DocumentModel
