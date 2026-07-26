// Yapay zekâ (ruhsat okuma) yapılandırması — Google Gemini.
//
// API anahtarı almak: https://aistudio.google.com/app/apikey  (ücretsiz)
//
// Anahtarı iki yoldan biriyle verebilirsiniz:
//  1) Aşağıdaki GEMINI_API_KEY sabitine yapıştırın, veya
//  2) Ortam değişkeni: .env dosyasına  EXPO_PUBLIC_GEMINI_API_KEY=... yazın.
//
// Not: Anahtar uygulamanın içine gömülür. Üretim/yayın için anahtarı doğrudan
// gömmek yerine kendi sunucunuz üzerinden (proxy) çağırmanız önerilir.

const GEMINI_API_KEY = ''

export const AI_CONFIG = {
  geminiApiKey: (process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? GEMINI_API_KEY).trim(),
  // Görsel (vision) destekli güncel Flash model.
  geminiModel: process.env.EXPO_PUBLIC_GEMINI_MODEL?.trim() || 'gemini-3.5-flash',
}

export function isAiConfigured(): boolean {
  return AI_CONFIG.geminiApiKey.length > 0
}
