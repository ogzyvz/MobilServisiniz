import type { Customer, StockProduct, Vehicle } from './types'

export const initialVehicles: Vehicle[] = [
  {
    id: 'v1',
    workOrderId: 'wo1',
    plate: '34 ABC 123',
    brand: 'Volkswagen',
    model: 'Passat 1.6 TDI',
    year: '2019',
    color: 'Beyaz',
    fuel: 'Dizel',
    chassis: 'WVWZZZ3CZKE012345',
    engineNo: 'CXXA123456',
    engineVolume: '1598 cm³',
    km: '128.400',
    status: 'islemde',
    createdAt: '2026-07-14T08:30:00',
    customer: {
      id: 'c1',
      name: 'Ahmet Yılmaz',
      phone: '0532 111 22 33',
      address: 'Ataşehir, İstanbul',
    },
    complaints: [
      {
        id: 'k1',
        text: 'Motordan tıkırtı sesi geliyor, rölantide titreşim var.',
        createdAt: '2026-07-14T08:35:00',
      },
      {
        id: 'k2',
        text: 'Ön fren balataları ses yapıyor.',
        createdAt: '2026-07-14T08:36:00',
      },
    ],
    services: [
      { id: 's1', title: 'Yağ ve filtre değişimi', price: 1850 },
      { id: 's2', title: 'Ön fren balata değişimi (işçilik)', price: 900 },
    ],
    products: [
      { id: 'p1', name: 'Motor yağı 5W-30 (5L)', quantity: 1, price: 1200, source: 'stok' },
      { id: 'p2', name: 'Yağ filtresi', quantity: 1, price: 320, source: 'stok' },
      { id: 'p3', name: 'Ön fren balatası', quantity: 1, price: 780, source: 'stok' },
    ],
  },
  {
    id: 'v2',
    workOrderId: 'wo2',
    plate: '06 DE 456',
    brand: 'Renault',
    model: 'Clio 1.5 dCi',
    year: '2017',
    color: 'Gri',
    fuel: 'Dizel',
    chassis: 'VF1RFB00X12345678',
    engineNo: 'K9K712345',
    engineVolume: '1461 cm³',
    km: '96.750',
    status: 'bekliyor',
    createdAt: '2026-07-14T09:10:00',
    customer: {
      id: 'c2',
      name: 'Elif Demir',
      phone: '0505 444 55 66',
      address: 'Çankaya, Ankara',
    },
    complaints: [
      {
        id: 'k3',
        text: 'Klima soğutmuyor, gaz basılması gerekiyor.',
        createdAt: '2026-07-14T09:12:00',
      },
    ],
    services: [],
    products: [],
  },
  {
    id: 'v3',
    workOrderId: 'wo3',
    plate: '35 FGH 789',
    brand: 'Fiat',
    model: 'Egea 1.4 Fire',
    year: '2021',
    color: 'Kırmızı',
    fuel: 'Benzin',
    chassis: 'ZFA33400009876543',
    engineNo: '843A1000123',
    engineVolume: '1368 cm³',
    km: '54.200',
    status: 'tamamlandi',
    createdAt: '2026-07-13T14:00:00',
    customer: {
      id: 'c3',
      name: 'Mehmet Kaya',
      phone: '0542 777 88 99',
      address: 'Karşıyaka, İzmir',
    },
    complaints: [
      {
        id: 'k4',
        text: 'Periyodik bakım ve genel kontrol istendi.',
        createdAt: '2026-07-13T14:05:00',
      },
    ],
    services: [{ id: 's3', title: 'Periyodik bakım', price: 1400 }],
    products: [
      { id: 'p4', name: 'Motor yağı 10W-40 (4L)', quantity: 1, price: 950, source: 'stok' },
      { id: 'p5', name: 'Hava filtresi', quantity: 1, price: 280, source: 'stok' },
      { id: 'p6', name: 'Polen filtresi', quantity: 1, price: 240, source: 'stok' },
    ],
  },
]

export const initialCustomers: Customer[] = [
  { id: 'c1', name: 'Ahmet Yılmaz', phone: '0532 111 22 33', address: 'Ataşehir, İstanbul' },
  { id: 'c2', name: 'Elif Demir', phone: '0505 444 55 66', address: 'Çankaya, Ankara' },
  { id: 'c3', name: 'Mehmet Kaya', phone: '0542 777 88 99', address: 'Karşıyaka, İzmir' },
  { id: 'c4', name: 'Zeynep Şahin', phone: '0533 222 33 44', address: 'Nilüfer, Bursa' },
  { id: 'c5', name: 'Hasan Öztürk', phone: '0555 987 65 43', address: 'Muratpaşa, Antalya' },
  { id: 'c6', name: 'Fatma Aydın', phone: '0536 314 15 92', address: 'Selçuklu, Konya' },
  { id: 'c7', name: 'Mustafa Çelik', phone: '0544 271 82 81', address: 'Şehitkamil, Gaziantep' },
  { id: 'c8', name: 'Ayşe Kara', phone: '0507 616 09 34', address: 'Seyhan, Adana' },
  { id: 'c9', name: 'İbrahim Doğan', phone: '0553 141 62 78', address: 'Odunpazarı, Eskişehir' },
  { id: 'c10', name: 'Emine Arslan', phone: '0538 902 45 67', address: 'İlkadım, Samsun' },
  { id: 'c11', name: 'Ali Koç', phone: '0541 358 97 11', address: 'Yıldırım, Bursa' },
  { id: 'c12', name: 'Hatice Yıldız', phone: '0506 733 20 58', address: 'Pamukkale, Denizli' },
  { id: 'c13', name: 'Osman Aksoy', phone: '0555 448 63 29', address: 'Merkez, Trabzon' },
  { id: 'c14', name: 'Sevgi Polat', phone: '0537 190 74 03', address: 'Kepez, Antalya' },
  { id: 'c15', name: 'Kemal Erdoğan', phone: '0543 826 51 40', address: 'Melikgazi, Kayseri' },
]

export const initialStock: StockProduct[] = [
  { id: 'st1', name: 'Motor Yağı 5W-30 (5L)', category: 'yag', code: 'YG-530-5', price: 1200, stock: 24 },
  { id: 'st2', name: 'Motor Yağı 10W-40 (4L)', category: 'yag', code: 'YG-1040-4', price: 950, stock: 18 },
  { id: 'st3', name: 'Yağ Filtresi', category: 'filtre', code: 'FL-YAG-01', price: 320, stock: 60 },
  { id: 'st4', name: 'Hava Filtresi', category: 'filtre', code: 'FL-HVA-02', price: 280, stock: 42 },
  { id: 'st5', name: 'Polen Filtresi', category: 'filtre', code: 'FL-PLN-03', price: 240, stock: 37 },
  { id: 'st6', name: 'Ön Fren Balatası', category: 'fren', code: 'FR-BLT-ON', price: 780, stock: 15 },
  { id: 'st7', name: 'Fren Diski (çift)', category: 'fren', code: 'FR-DSK-01', price: 1650, stock: 8 },
  { id: 'st8', name: 'Akü 60Ah', category: 'elektrik', code: 'EL-AKU-60', price: 2450, stock: 6 },
  { id: 'st9', name: 'Buji Takımı (4lü)', category: 'elektrik', code: 'EL-BUJ-04', price: 640, stock: 20 },
  { id: 'st10', name: 'Ön Lastik 205/55 R16', category: 'lastik', code: 'LS-2055-16', price: 2100, stock: 12 },
]

// Yapay zekanın ruhsattan okuduğu bilgileri simüle eder.
export const aiScanSamples: Array<{
  plate: string
  brand: string
  model: string
  year: string
  color: string
  fuel: string
  chassis: string
  engineNo: string
  engineVolume: string
}> = [
  {
    plate: '34 KLM 902',
    brand: 'Toyota',
    model: 'Corolla 1.6',
    year: '2020',
    color: 'Siyah',
    fuel: 'Benzin',
    chassis: 'NMTBA3JE60R123456',
    engineNo: '2ZR1234567',
    engineVolume: '1598 cm³',
  },
  {
    plate: '16 BN 210',
    brand: 'Ford',
    model: 'Focus 1.5 TDCi',
    year: '2018',
    color: 'Lacivert',
    fuel: 'Dizel',
    chassis: 'WF0AXXGCDAKE12345',
    engineNo: 'XTDA123456',
    engineVolume: '1499 cm³',
  },
  {
    plate: '01 CD 774',
    brand: 'Hyundai',
    model: 'i20 1.4 MPI',
    year: '2022',
    color: 'Beyaz',
    fuel: 'Benzin',
    chassis: 'NLHB251CAMZ123456',
    engineNo: 'G4LC123456',
    engineVolume: '1368 cm³',
  },
]
