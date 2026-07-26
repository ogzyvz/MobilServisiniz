-- OtoServis — örnek veriler (SQLite)
-- Uygulama ilk açılışta bu verileri otomatik ekler; bu dosya manuel kurulum içindir.

BEGIN TRANSACTION;

-- Demo giriş hesabı  (telefon: 05551112233 / şifre: 1234)
-- password_hash = SHA-256('otoservis::v1:1234')
INSERT OR REPLACE INTO users (id, name, phone, password_hash, created_at) VALUES
  ('demo', 'Demo Usta', '05551112233',
   '8d58466dcaa8223599a1a7162e8d1bd4e45318c7fb24a73760c7d4f3fcfb9a93',
   '2026-07-14T00:00:00');

-- Müşteriler
INSERT OR REPLACE INTO customers (id, name, phone, address) VALUES
  ('c1', 'Ahmet Yılmaz',  '0532 111 22 33', 'Ataşehir, İstanbul'),
  ('c2', 'Elif Demir',    '0505 444 55 66', 'Çankaya, Ankara'),
  ('c3', 'Mehmet Kaya',   '0542 777 88 99', 'Karşıyaka, İzmir'),
  ('c4', 'Zeynep Şahin',  '0533 222 33 44', 'Nilüfer, Bursa'),
  ('c5', 'Hasan Öztürk',  '0555 987 65 43', 'Muratpaşa, Antalya');

-- Stok / ürünler
INSERT OR REPLACE INTO stock_products (id, name, category, code, price, stock) VALUES
  ('st1',  'Motor Yağı 5W-30 (5L)',    'yag',      'YG-530-5',   1200, 24),
  ('st2',  'Motor Yağı 10W-40 (4L)',   'yag',      'YG-1040-4',   950, 18),
  ('st3',  'Yağ Filtresi',             'filtre',   'FL-YAG-01',   320, 60),
  ('st4',  'Hava Filtresi',            'filtre',   'FL-HVA-02',   280, 42),
  ('st5',  'Polen Filtresi',           'filtre',   'FL-PLN-03',   240, 37),
  ('st6',  'Ön Fren Balatası',         'fren',     'FR-BLT-ON',   780, 15),
  ('st7',  'Fren Diski (çift)',        'fren',     'FR-DSK-01',  1650,  8),
  ('st8',  'Akü 60Ah',                 'elektrik', 'EL-AKU-60',  2450,  6),
  ('st9',  'Buji Takımı (4lü)',        'elektrik', 'EL-BUJ-04',   640, 20),
  ('st10', 'Ön Lastik 205/55 R16',     'lastik',   'LS-2055-16', 2100, 12);

-- Araçlar
INSERT OR REPLACE INTO vehicles
  (id, plate, brand, model, year, color, fuel, chassis, km, status, created_at, customer_id) VALUES
  ('v1', '34 ABC 123', 'Volkswagen', 'Passat 1.6 TDI', '2019', 'Beyaz',   'Dizel',  'WVWZZZ3CZKE012345', '128.400', 'islemde',    '2026-07-14T08:30:00', 'c1'),
  ('v2', '06 DE 456',  'Renault',    'Clio 1.5 dCi',   '2017', 'Gri',     'Dizel',  'VF1RFB00X12345678', '96.750',  'bekliyor',   '2026-07-14T09:10:00', 'c2'),
  ('v3', '35 FGH 789', 'Fiat',       'Egea 1.4 Fire',  '2021', 'Kırmızı', 'Benzin', 'ZFA33400009876543', '54.200',  'tamamlandi', '2026-07-13T14:00:00', 'c3');

-- Şikayetler
INSERT OR REPLACE INTO complaints (id, vehicle_id, text, created_at) VALUES
  ('k1', 'v1', 'Motordan tıkırtı sesi geliyor, rölantide titreşim var.', '2026-07-14T08:35:00'),
  ('k2', 'v1', 'Ön fren balataları ses yapıyor.',                        '2026-07-14T08:36:00'),
  ('k3', 'v2', 'Klima soğutmuyor, gaz basılması gerekiyor.',             '2026-07-14T09:12:00'),
  ('k4', 'v3', 'Periyodik bakım ve genel kontrol istendi.',              '2026-07-13T14:05:00');

-- İşlemler (işçilik)
INSERT OR REPLACE INTO services (id, vehicle_id, title, price) VALUES
  ('s1', 'v1', 'Yağ ve filtre değişimi',              1850),
  ('s2', 'v1', 'Ön fren balata değişimi (işçilik)',    900),
  ('s3', 'v3', 'Periyodik bakım',                      1400);

-- Araca eklenen ürün/parçalar
INSERT OR REPLACE INTO vehicle_products (id, vehicle_id, name, quantity, price) VALUES
  ('p1', 'v1', 'Motor yağı 5W-30 (5L)', 1, 1200),
  ('p2', 'v1', 'Yağ filtresi',          1,  320),
  ('p3', 'v1', 'Ön fren balatası',      1,  780),
  ('p4', 'v3', 'Motor yağı 10W-40 (4L)',1,  950),
  ('p5', 'v3', 'Hava filtresi',         1,  280),
  ('p6', 'v3', 'Polen filtresi',        1,  240);

COMMIT;
