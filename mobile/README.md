# MobilServisiniz — React Native (Expo)

Web (Next.js) sürümündeki "MobilServisiniz" araç servis kayıt uygulamasının React Native / Expo'ya taşınmış hali. Tasarım (renkler, düzen, akış) web sürümüyle birebir korunmuştur.

## Teknolojiler

- **Expo** (SDK 57) + **React Native** 0.86
- **NativeWind v4** — Tailwind CSS sınıfları (`className`) React Native'de
- **lucide-react-native** — ikonlar (web'deki `lucide-react` karşılığı)
- **react-native-safe-area-context** — çentik/güvenli alan yönetimi
- **expo-sqlite** — cihazda kalıcı yerel veritabanı
- **expo-crypto** — parola özetleme (SHA-256) ile giriş/kayıt
- **expo-image-picker** — ruhsat fotoğrafı (kamera + galeri)
- **Sunucu AI failover** — ruhsattan araç bilgilerini otomatik okuma (Gemini → OpenAI)

## Yapay Zekâ ile Ruhsat Okuma

Yeni araç kaydında ruhsat fotoğrafı **API’ye** gönderilir; sunucu sırayla:

1. `gemini-3.5-flash-lite` (ücretsiz, güncel)
2. `gemini-3.5-flash` (ücretsiz yedek)
3. `gpt-4o-mini` (OpenAI, kota bitince)
4. Sunucu OCR (Tesseract) — AI başarısız olursa

Kod: mobil `src/lib/ai-scan.ts` → `POST /api/ai/scan-ruhsat`.

**Anahtarlar sunucuda** (`api/OtoServis.Api/appsettings.json` → `Ai`):

- Gemini: [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
- OpenAI (opsiyonel): [platform.openai.com/api-keys](https://platform.openai.com/api-keys)

Anahtar değişince sadece API’yi yeniden başlatın; APK gerekmez.

## Veritabanı

Uygulama, verileri cihazda **SQLite** (`expo-sqlite`) ile kalıcı olarak saklar.
İlk açılışta şema otomatik oluşturulur ve örnek verilerle doldurulur.
Kod: `src/lib/db.ts`. Hazır SQL betikleri `db/` klasöründedir:

- `db/schema.sql` — SQLite şeması (tablolar, indeksler)
- `db/seed.sql` — örnek veriler (SQLite)
- `db/postgres.sql` — ileride sunucu tarafı için PostgreSQL şema + örnek veri

Tablolar: `users`, `customers`, `vehicles`, `complaints`, `services`,
`vehicle_products`, `stock_products`.

Giriş/Kayıt gerçek `users` tablosuna bağlıdır; parolalar SHA-256 ile özetlenir.
İlk kullanımda **Kayıt Ol** ile bir hesap oluşturun, sonra bu telefon/parola ile
giriş yapın.

## APK Derleme

> Windows'ta React Native'in New Architecture C++ codegen'i uzun dosya yolları
> ürettiği için, **yerel** derlemeden önce Windows Uzun Yol desteğinin açık
> olması gerekir. Bu bir kere yapılır.

### Yöntem 1 — EAS Build (bulut, önerilen; yönetici/uzun-yol gerektirmez)

```bash
npm install -g eas-cli
eas login                              # ücretsiz Expo hesabı
eas build -p android --profile preview # bulutta APK üretir, indirme linki verir
```

### Yöntem 2 — Yerel derleme (Windows) — bu projede kullanılan yöntem

Windows'ta iki yol-uzunluğu engeli vardır; her ikisi de aşağıda çözülür:

1. **Uzun yol desteğini açın** (bir kez, Yönetici PowerShell) ve yeniden başlatın:

```powershell
reg add "HKLM\SYSTEM\CurrentControlSet\Control\FileSystem" /v LongPathsEnabled /t REG_DWORD /d 1 /f
git config --system core.longpaths true
```

2. **Uzun-yol destekli ninja** (≥1.12) kurun. SDK'daki ninja 1.10.2 uzun yolları
   reddeder. `android/app/build.gradle` içindeki `defaultConfig.externalNativeBuild.cmake`
   bloğu, ninja'yı `C:/gr/ninja/ninja.exe` yolundan kullanacak şekilde ayarlıdır:

```powershell
Invoke-WebRequest "https://github.com/ninja-build/ninja/releases/download/v1.12.1/ninja-win.zip" -OutFile C:\gr\ninja-win.zip
Expand-Archive C:\gr\ninja-win.zip C:\gr\ninja -Force
```

3. Derleyin (`reanimated`/`worklets` native'i `react-native.config.js` ile kapalıdır;
   uygulamada animasyon sınıfı kullanılmadığından güvenlidir ve derlemeyi hızlandırır):

```powershell
cd mobile\android
.\gradlew.bat assembleRelease -PreactNativeArchitectures=arm64-v8a
```

APK çıktısı: `mobile/android/app/build/outputs/apk/release/app-release.apk`
(debug anahtarıyla imzalıdır; test cihazlarına doğrudan kurulabilir).

> Tüm ABI'ler için (daha büyük, evrensel APK) `-PreactNativeArchitectures` bayrağını
> kaldırın veya `arm64-v8a,armeabi-v7a` verin.

## Kurulum

```bash
cd mobile
npm install
```

## Çalıştırma

```bash
npm start          # Expo geliştirme sunucusu (QR kod ile Expo Go)
npm run android    # Android emülatör/cihaz
npm run ios        # iOS simülatörü (yalnızca macOS)
```

Telefonda **Expo Go** uygulamasını kurup terminalde çıkan QR kodu okutarak anında çalıştırabilirsiniz.

## Proje Yapısı

```
mobile/
├─ App.tsx                 # Giriş noktası (SafeAreaProvider + StatusBar)
├─ global.css              # Tailwind direktifleri (NativeWind)
├─ tailwind.config.js      # Renk paleti ve tema (web CSS değişkenlerinin hex karşılığı)
├─ eas.json                # EAS Build profilleri (APK / app-bundle)
├─ db/                     # SQL betikleri (schema.sql, seed.sql, postgres.sql)
├─ src/
│  ├─ service-app.tsx      # Ana durum yönetimi + alt navigasyon
│  ├─ lib/                 # types, mock-data, format, utils, theme, db (SQLite)
│  ├─ components/          # form-field, status-badge, vehicle-card
│  └─ screens/             # login, dashboard, vehicle-list, vehicle-detail,
│                          #   new-vehicle-flow, customers, products
```

## Web ↔ React Native karşılıkları

| Web (Next.js)            | React Native                          |
| ------------------------ | ------------------------------------- |
| `div` / `span`           | `View`                                |
| metin                    | `Text` (tüm yazılar sarmalanır)       |
| `button` + `onClick`     | `Pressable` + `onPress`               |
| `input` / `textarea`     | `TextInput`                           |
| `select`                 | `SelectField` (alttan açılan modal)   |
| `lucide-react`           | `lucide-react-native`                 |
| CSS `oklch` değişkenleri | hex renkler (`tailwind.config.js`)    |
| sticky/fixed header      | sabit `View` + kaydırılan `ScrollView`|
| `Intl` biçimlendirme     | elle Türkçe biçimlendirme (`format.ts`)|

Tüm iş mantığı (ekleme/düzenleme/silme, filtreleme, durum değişimi, ruhsat tarama simülasyonu) web sürümüyle aynıdır.
