import MeterReading from '../../models/MeterReading'

export async function deleteReadingById(id: string) {
    const reading = await MeterReading.findById(id)
    if (!reading) return { status: 'reading_not_found' as const }

    await MeterReading.findByIdAndDelete(id)

    return { status: 'deleted' as const }
}