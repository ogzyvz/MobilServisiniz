import { scanRuhsatApi } from './api'

export type ScanResult = {
  plate: string
  brand: string
  model: string
  year: string
  color: string
  fuel: string
  chassis: string
  engineNo: string
  engineVolume: string
}

/**
 * Ruhsat fotoğrafını (base64) API’ye gönderir.
 * Sunucu Gemini → Gemini Lite → OpenAI zinciriyle okur.
 */
export async function scanRuhsat(
  base64Image: string,
  mimeType = 'image/jpeg',
): Promise<ScanResult> {
  return scanRuhsatApi(base64Image, mimeType)
}
