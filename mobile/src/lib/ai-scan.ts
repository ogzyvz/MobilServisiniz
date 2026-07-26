import { AI_CONFIG } from './ai-config'

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

const EMPTY: ScanResult = {
  plate: '',
  brand: '',
  model: '',
  year: '',
  color: '',
  fuel: '',
  chassis: '',
  engineNo: '',
  engineVolume: '',
}

const PROMPT = `Bu görsel bir Türkiye Cumhuriyeti araç tescil belgesidir (ruhsat).
Görseldeki bilgileri oku ve SADECE aşağıdaki alanları içeren bir JSON döndür:
{"plate":"","brand":"","model":"","year":"","color":"","fuel":"","chassis":"","engineNo":"","engineVolume":""}

Kurallar:
- plate: Plaka; "34 ABC 123" biçiminde, harfler BÜYÜK, aralarında tek boşluk.
- brand: Marka (örn. Volkswagen, Renault, Fiat).
- model: Ticari adı / tipi (örn. Passat, Clio, Egea).
- year: Model yılı, 4 haneli (örn. 2019).
- color: Rengi, Türkçe (örn. Beyaz, Gri).
- fuel: Yakıt türü; şu değerlerden biri: Benzin, Dizel, LPG, Elektrik, Hibrit.
- chassis: Şasi (VIN) numarası, 17 karakter, BÜYÜK harf.
- engineNo: Motor numarası (ruhsattaki "Motor No" / "Motor Numarası" alanı), BÜYÜK harf.
- engineVolume: Motor hacmi (cm³ veya litre); örn. "1598" veya "1.6". Varsa birimi de yazabilirsin (örn. "1598 cm³").
Bir alanı okuyamazsan o alanı boş string ("") bırak.
Yalnızca geçerli JSON döndür; açıklama, kod bloğu veya başka metin ekleme.`

function pickString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

function normalize(raw: unknown): ScanResult {
  const o = (raw ?? {}) as Record<string, unknown>
  return {
    plate: pickString(o.plate).toUpperCase(),
    brand: pickString(o.brand),
    model: pickString(o.model),
    year: pickString(o.year).replace(/[^0-9]/g, '').slice(0, 4),
    color: pickString(o.color),
    fuel: pickString(o.fuel),
    chassis: pickString(o.chassis).toUpperCase(),
    engineNo: pickString(o.engineNo ?? o.engine_no).toUpperCase(),
    engineVolume: pickString(o.engineVolume ?? o.engine_volume),
  }
}

/**
 * Ruhsat fotoğrafını (base64) Gemini görsel modeline gönderip araç bilgilerini
 * yapılandırılmış olarak döndürür.
 */
export async function scanRuhsat(
  base64Image: string,
  mimeType = 'image/jpeg',
): Promise<ScanResult> {
  const key = AI_CONFIG.geminiApiKey
  if (!key) {
    throw new Error(
      'Yapay zekâ anahtarı ayarlı değil. src/lib/ai-config.ts dosyasına Gemini API anahtarınızı ekleyin.',
    )
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${AI_CONFIG.geminiModel}:generateContent?key=${encodeURIComponent(key)}`

  const body = {
    contents: [
      {
        parts: [
          { text: PROMPT },
          { inline_data: { mime_type: mimeType, data: base64Image } },
        ],
      },
    ],
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json',
    },
  }

  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error('İnternet bağlantısı kurulamadı. Bağlantınızı kontrol edin.')
  }

  if (!res.ok) {
    let detail = ''
    try {
      const err = await res.json()
      detail = err?.error?.message ?? ''
    } catch {
      detail = await res.text().catch(() => '')
    }
    if (res.status === 400 || res.status === 403) {
      throw new Error('API anahtarı geçersiz veya yetkisiz. Anahtarı kontrol edin.')
    }
    if (res.status === 429) {
      throw new Error('Kota doldu, biraz sonra tekrar deneyin.')
    }
    throw new Error(`Yapay zekâ isteği başarısız (${res.status}). ${detail}`.trim())
  }

  const json = await res.json()
  const text: unknown =
    json?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('Ruhsat okunamadı. Daha net bir fotoğraf deneyin.')
  }

  try {
    return normalize(JSON.parse(text))
  } catch {
    const match = text.match(/\{[\s\S]*\}/)
    if (match) {
      try {
        return normalize(JSON.parse(match[0]))
      } catch {
        // düşer
      }
    }
    return EMPTY
  }
}
