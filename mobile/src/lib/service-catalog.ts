// Hazır servis (işçilik) adları kataloğu.
// Araç detayında "İşlem Ekle" sırasında hızlı seçim için kullanılır.
// SQL Server'daki `service_catalog` tablosuyla (db/sqlserver) aynı listedir.

export type ServiceCatalogCategory =
  | 'periyodik'
  | 'motor'
  | 'fren'
  | 'suspansiyon'
  | 'elektrik'
  | 'klima'
  | 'sanziman'
  | 'lastik'
  | 'kaporta'

export type ServiceCatalogItem = {
  name: string
  price: number
  category: ServiceCatalogCategory
}

export const SERVICE_CATEGORY_LABELS: Record<ServiceCatalogCategory, string> = {
  periyodik: 'Periyodik',
  motor: 'Motor',
  fren: 'Fren',
  suspansiyon: 'Süspansiyon',
  elektrik: 'Elektrik',
  klima: 'Klima',
  sanziman: 'Şanzıman',
  lastik: 'Lastik',
  kaporta: 'Kaporta',
}

export const serviceCatalog: ServiceCatalogItem[] = [
  // Periyodik
  { name: 'Periyodik bakım', price: 1400, category: 'periyodik' },
  { name: 'Yağ ve filtre değişimi', price: 1850, category: 'periyodik' },
  { name: 'Genel kontrol / ekspertiz', price: 500, category: 'periyodik' },

  // Motor
  { name: 'Triger seti değişimi', price: 3500, category: 'motor' },
  { name: 'Triger + devirdaim değişimi', price: 4200, category: 'motor' },
  { name: 'Devirdaim (su pompası) değişimi', price: 1800, category: 'motor' },
  { name: 'Motor üst takım conta değişimi', price: 6500, category: 'motor' },
  { name: 'Enjektör temizliği', price: 1200, category: 'motor' },
  { name: 'Turbo değişimi', price: 5500, category: 'motor' },
  { name: 'V kayışı değişimi', price: 700, category: 'motor' },

  // Fren
  { name: 'Ön fren balata değişimi', price: 900, category: 'fren' },
  { name: 'Arka fren balata değişimi', price: 850, category: 'fren' },
  { name: 'Ön fren disk değişimi', price: 1200, category: 'fren' },
  { name: 'Arka fren disk değişimi', price: 1100, category: 'fren' },
  { name: 'Fren hidroliği değişimi', price: 500, category: 'fren' },
  { name: 'ABS arıza tespit', price: 700, category: 'fren' },

  // Süspansiyon
  { name: 'Ön amortisör değişimi', price: 1600, category: 'suspansiyon' },
  { name: 'Arka amortisör değişimi', price: 1500, category: 'suspansiyon' },
  { name: 'Rot başı değişimi', price: 700, category: 'suspansiyon' },
  { name: 'Rotil değişimi', price: 750, category: 'suspansiyon' },
  { name: 'Salıncak değişimi', price: 1300, category: 'suspansiyon' },
  { name: 'Aks körüğü değişimi', price: 900, category: 'suspansiyon' },
  { name: 'Rot balans ayarı', price: 600, category: 'suspansiyon' },

  // Elektrik
  { name: 'Akü değişimi', price: 400, category: 'elektrik' },
  { name: 'Marş motoru tamiri', price: 1500, category: 'elektrik' },
  { name: 'Alternatör tamiri', price: 1600, category: 'elektrik' },
  { name: 'Buji değişimi', price: 500, category: 'elektrik' },
  { name: 'Arıza tespit (diagnostik)', price: 600, category: 'elektrik' },
  { name: 'Far / ampul değişimi', price: 350, category: 'elektrik' },

  // Klima
  { name: 'Klima gaz dolumu', price: 900, category: 'klima' },
  { name: 'Klima bakımı (polen + gaz)', price: 1300, category: 'klima' },
  { name: 'Klima kompresör değişimi', price: 4500, category: 'klima' },

  // Şanzıman
  { name: 'Şanzıman yağı değişimi', price: 1500, category: 'sanziman' },
  { name: 'Debriyaj seti değişimi', price: 4800, category: 'sanziman' },
  { name: 'Otomatik şanzıman bakımı', price: 3200, category: 'sanziman' },

  // Lastik
  { name: 'Lastik değişimi (4 adet)', price: 600, category: 'lastik' },
  { name: 'Lastik tamiri', price: 200, category: 'lastik' },
  { name: 'Balans ayarı', price: 400, category: 'lastik' },
  { name: 'Rot ayarı', price: 500, category: 'lastik' },

  // Kaporta
  { name: 'Göçük düzeltme (boyasız)', price: 1500, category: 'kaporta' },
  { name: 'Boya (parça başı)', price: 2500, category: 'kaporta' },
]
