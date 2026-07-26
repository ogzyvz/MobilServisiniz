import type { Customer, StockProduct, Vehicle } from './types'

export const initialVehicles: Vehicle[] = [
  {
    id: 'v1',
    plate: '34 ABC 123',
    brand: 'Volkswagen',
    model: 'Passat 1.6 TDI',
    year: '2019',
    color: 'Beyaz',
    fuel: 'Dizel',
    chassis: 'WVWZZZ3CZKE012345',
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
      { id: 'p1', name: 'Motor yağı 5W-30 (5L)', quantity: 1, price: 1200 },
      { id: 'p2', name: 'Yağ filtresi', quantity: 1, price: 320 },
      { id: 'p3', name: 'Ön fren balatası', quantity: 1, price: 780 },
    ],
  },
  {
    id: 'v2',
    plate: '06 DE 456',
    brand: 'Renault',
    model: 'Clio 1.5 dCi',
    year: '2017',
    color: 'Gri',
    fuel: 'Dizel',
    chassis: 'VF1RFB00X12345678',
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
    plate: '35 FGH 789',
    brand: 'Fiat',
    model: 'Egea 1.4 Fire',
    year: '2021',
    color: 'Kırmızı',
    fuel: 'Benzin',
    chassis: 'ZFA33400009876543',
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
      { id: 'p4', name: 'Motor yağı 10W-40 (4L)', quantity: 1, price: 950 },
      { id: 'p5', name: 'Hava filtresi', quantity: 1, price: 280 },
      { id: 'p6', name: 'Polen filtresi', quantity: 1, price: 240 },
    ],
  },
]

export const initialCustomers: Customer[] = [
  { id: 'c1', name: 'Ahmet Yılmaz', phone: '0532 111 22 33', address: 'Ataşehir, İstanbul' },
  { id: 'c2', name: 'Elif Demir', phone: '0505 444 55 66', address: 'Çankaya, Ankara' },
  { id: 'c3', name: 'Mehmet Kaya', phone: '0542 777 88 99', address: 'Karşıyaka, İzmir' },
  { id: 'c4', name: 'Zeynep Şahin', phone: '0533 222 33 44', address: 'Nilüfer, Bursa' },
  { id: 'c5', name: 'Hasan Öztürk', phone: '0555 987 65 43', address: 'Muratpaşa, Antalya' },
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
}> = [
  {
    plate: '34 KLM 902',
    brand: 'Toyota',
    model: 'Corolla 1.6',
    year: '2020',
    color: 'Siyah',
    fuel: 'Benzin',
    chassis: 'NMTBA3JE60R123456',
  },
  {
    plate: '16 BN 210',
    brand: 'Ford',
    model: 'Focus 1.5 TDCi',
    year: '2018',
    color: 'Lacivert',
    fuel: 'Dizel',
    chassis: 'WF0AXXGCDAKE12345',
  },
  {
    plate: '01 CD 774',
    brand: 'Hyundai',
    model: 'i20 1.4 MPI',
    year: '2022',
    color: 'Beyaz',
    fuel: 'Benzin',
    chassis: 'NLHB251CAMZ123456',
  },
]
