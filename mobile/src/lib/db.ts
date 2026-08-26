import * as SQLite from 'expo-sqlite'
import * as Crypto from 'expo-crypto'
import {
  initialCustomers,
  initialStock,
  initialVehicles,
} from './mock-data'
import type {
  Customer,
  JobStatus,
  StockCategory,
  StockProduct,
  Vehicle,
} from './types'

const DB_NAME = 'otoservis.db'
// Şifre özetlemesi için sabit tuz (yalnızca yerel demo amaçlı).
const PASSWORD_SALT = 'otoservis::v1'

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null

function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DB_NAME)
  }
  return dbPromise
}

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'personel',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT
);

CREATE TABLE IF NOT EXISTS vehicles (
  id TEXT PRIMARY KEY NOT NULL,
  plate TEXT NOT NULL,
  brand TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  year TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '',
  fuel TEXT NOT NULL DEFAULT '',
  chassis TEXT NOT NULL DEFAULT '',
  engine_no TEXT NOT NULL DEFAULT '',
  engine_volume TEXT NOT NULL DEFAULT '',
  km TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'bekliyor',
  created_at TEXT NOT NULL,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS complaints (
  id TEXT PRIMARY KEY NOT NULL,
  vehicle_id TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS services (
  id TEXT PRIMARY KEY NOT NULL,
  vehicle_id TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  price REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS vehicle_products (
  id TEXT PRIMARY KEY NOT NULL,
  vehicle_id TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  price REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS stock_products (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'diger',
  code TEXT NOT NULL DEFAULT '-',
  price REAL NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_vehicles_customer ON vehicles(customer_id);
CREATE INDEX IF NOT EXISTS idx_complaints_vehicle ON complaints(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_services_vehicle ON services(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_products_vehicle ON vehicle_products(vehicle_id);
`

/** Tabloları oluşturur ve tablolar boşsa örnek verilerle doldurur. */
export async function initDatabase(): Promise<void> {
  const db = await getDb()
  await db.execAsync(SCHEMA)

  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM customers',
  )
  if ((row?.count ?? 0) === 0) {
    await seed(db)
  }
}

// Demo giriş hesabı (ilk kurulumda otomatik oluşturulur).
export const DEMO_PHONE = '05551112233'
export const DEMO_PASSWORD = '1234'

// İlk kurulumda oluşturulan personel hesapları.
// Hepsinin şifresi DEMO_PASSWORD (1234) — farklı telefonlarla giriş denenebilir.
const DEMO_USERS: { id: string; name: string; phone: string; role: string }[] = [
  { id: 'u1', name: 'Demo Usta', phone: DEMO_PHONE, role: 'admin' },
  { id: 'u2', name: 'Mehmet Demirci', phone: '05321110001', role: 'usta' },
  { id: 'u3', name: 'Ali Yıldız', phone: '05321110002', role: 'usta' },
  { id: 'u4', name: 'Ayşe Korkmaz', phone: '05321110003', role: 'personel' },
  { id: 'u5', name: 'Hasan Aydın', phone: '05321110004', role: 'admin' },
]

async function seed(db: SQLite.SQLiteDatabase): Promise<void> {
  const demoHash = await hashPassword(DEMO_PASSWORD)
  const now = new Date().toISOString()
  await db.withTransactionAsync(async () => {
    for (const u of DEMO_USERS) {
      await db.runAsync(
        'INSERT OR REPLACE INTO users (id, name, phone, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [u.id, u.name, u.phone, demoHash, u.role, now],
      )
    }
    for (const c of initialCustomers) {
      await db.runAsync(
        'INSERT OR REPLACE INTO customers (id, name, phone, address) VALUES (?, ?, ?, ?)',
        [c.id, c.name, c.phone, c.address ?? null],
      )
    }
    for (const s of initialStock) {
      await db.runAsync(
        'INSERT OR REPLACE INTO stock_products (id, name, category, code, price, stock) VALUES (?, ?, ?, ?, ?, ?)',
        [s.id, s.name, s.category, s.code, s.price, s.stock],
      )
    }
    for (const v of initialVehicles) {
      await db.runAsync(
        `INSERT OR REPLACE INTO vehicles
          (id, plate, brand, model, year, color, fuel, chassis, engine_no, engine_volume, km, status, created_at, customer_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          v.id, v.plate, v.brand, v.model, v.year, v.color, v.fuel, v.chassis,
          v.engineNo ?? '', v.engineVolume ?? '', v.km, v.status, v.createdAt, v.customer.id,
        ],
      )
      for (const k of v.complaints) {
        await db.runAsync(
          'INSERT OR REPLACE INTO complaints (id, vehicle_id, text, created_at) VALUES (?, ?, ?, ?)',
          [k.id, v.id, k.text, k.createdAt],
        )
      }
      for (const s of v.services) {
        await db.runAsync(
          'INSERT OR REPLACE INTO services (id, vehicle_id, title, price) VALUES (?, ?, ?, ?)',
          [s.id, v.id, s.title, s.price],
        )
      }
      for (const p of v.products) {
        await db.runAsync(
          'INSERT OR REPLACE INTO vehicle_products (id, vehicle_id, name, quantity, price) VALUES (?, ?, ?, ?, ?)',
          [p.id, v.id, p.name, p.quantity, p.price],
        )
      }
    }
  })
}

// ---- Yükleme (load) ----

export async function loadCustomers(): Promise<Customer[]> {
  const db = await getDb()
  const rows = await db.getAllAsync<{
    id: string
    name: string
    phone: string
    address: string | null
  }>('SELECT id, name, phone, address FROM customers ORDER BY rowid DESC')
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    phone: r.phone,
    address: r.address ?? undefined,
  }))
}

export async function loadStock(): Promise<StockProduct[]> {
  const db = await getDb()
  const rows = await db.getAllAsync<{
    id: string
    name: string
    category: string
    code: string
    price: number
    stock: number
  }>('SELECT id, name, category, code, price, stock FROM stock_products ORDER BY rowid DESC')
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category as StockCategory,
    code: r.code,
    price: r.price,
    stock: r.stock,
  }))
}

export async function loadVehicles(): Promise<Vehicle[]> {
  const db = await getDb()
  const vRows = await db.getAllAsync<{
    id: string
    plate: string
    brand: string
    model: string
    year: string
    color: string
    fuel: string
    chassis: string
    engine_no: string
    engine_volume: string
    km: string
    status: string
    created_at: string
    customer_id: string
    c_name: string
    c_phone: string
    c_address: string | null
  }>(
    `SELECT v.*, c.name AS c_name, c.phone AS c_phone, c.address AS c_address
     FROM vehicles v JOIN customers c ON c.id = v.customer_id
     ORDER BY v.created_at DESC`,
  )

  const complaints = await db.getAllAsync<{
    id: string
    vehicle_id: string
    text: string
    created_at: string
  }>('SELECT id, vehicle_id, text, created_at FROM complaints ORDER BY rowid ASC')

  const services = await db.getAllAsync<{
    id: string
    vehicle_id: string
    title: string
    price: number
  }>('SELECT id, vehicle_id, title, price FROM services ORDER BY rowid ASC')

  const products = await db.getAllAsync<{
    id: string
    vehicle_id: string
    name: string
    quantity: number
    price: number
  }>('SELECT id, vehicle_id, name, quantity, price FROM vehicle_products ORDER BY rowid ASC')

  return vRows.map((v) => ({
    id: v.id,
    workOrderId: v.id,
    plate: v.plate,
    brand: v.brand,
    model: v.model,
    year: v.year,
    color: v.color,
    fuel: v.fuel,
    chassis: v.chassis,
    engineNo: v.engine_no,
    engineVolume: v.engine_volume,
    km: v.km,
    status: v.status as JobStatus,
    createdAt: v.created_at,
    customer: {
      id: v.customer_id,
      name: v.c_name,
      phone: v.c_phone,
      address: v.c_address ?? undefined,
    },
    complaints: complaints
      .filter((k) => k.vehicle_id === v.id)
      .map((k) => ({
        id: k.id,
        text: k.text,
        createdAt: k.created_at,
        category: 'diger' as const,
      })),
    services: services
      .filter((s) => s.vehicle_id === v.id)
      .map((s) => ({ id: s.id, title: s.title, price: s.price })),
    products: products
      .filter((p) => p.vehicle_id === v.id)
      .map((p) => ({ id: p.id, name: p.name, quantity: p.quantity, price: p.price, source: 'stok' as const })),
  }))
}

// ---- Kaydetme (persist) ----

export async function upsertCustomer(c: Customer): Promise<void> {
  const db = await getDb()
  await db.runAsync(
    'INSERT OR REPLACE INTO customers (id, name, phone, address) VALUES (?, ?, ?, ?)',
    [c.id, c.name, c.phone, c.address ?? null],
  )
}

export async function upsertStock(s: StockProduct): Promise<void> {
  const db = await getDb()
  await db.runAsync(
    'INSERT OR REPLACE INTO stock_products (id, name, category, code, price, stock) VALUES (?, ?, ?, ?, ?, ?)',
    [s.id, s.name, s.category, s.code, s.price, s.stock],
  )
}

/** Aracı ve tüm alt kayıtlarını (müşteri, şikayet, işlem, ürün) tek işlemde kaydeder. */
export async function persistVehicle(v: Vehicle): Promise<void> {
  const db = await getDb()
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'INSERT OR REPLACE INTO customers (id, name, phone, address) VALUES (?, ?, ?, ?)',
      [v.customer.id, v.customer.name, v.customer.phone, v.customer.address ?? null],
    )
    await db.runAsync(
      `INSERT OR REPLACE INTO vehicles
        (id, plate, brand, model, year, color, fuel, chassis, engine_no, engine_volume, km, status, created_at, customer_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        v.id, v.plate, v.brand, v.model, v.year, v.color, v.fuel, v.chassis,
        v.engineNo, v.engineVolume, v.km, v.status, v.createdAt, v.customer.id,
      ],
    )
    await db.runAsync('DELETE FROM complaints WHERE vehicle_id = ?', [v.id])
    await db.runAsync('DELETE FROM services WHERE vehicle_id = ?', [v.id])
    await db.runAsync('DELETE FROM vehicle_products WHERE vehicle_id = ?', [v.id])
    for (const k of v.complaints) {
      await db.runAsync(
        'INSERT INTO complaints (id, vehicle_id, text, created_at) VALUES (?, ?, ?, ?)',
        [k.id, v.id, k.text, k.createdAt],
      )
    }
    for (const s of v.services) {
      await db.runAsync(
        'INSERT INTO services (id, vehicle_id, title, price) VALUES (?, ?, ?, ?)',
        [s.id, v.id, s.title, s.price],
      )
    }
    for (const p of v.products) {
      await db.runAsync(
        'INSERT INTO vehicle_products (id, vehicle_id, name, quantity, price) VALUES (?, ?, ?, ?, ?)',
        [p.id, v.id, p.name, p.quantity, p.price],
      )
    }
  })
}

// ---- Kimlik doğrulama (auth) ----

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

async function hashPassword(password: string): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${PASSWORD_SALT}:${password}`,
  )
}

export type AuthResult =
  | { ok: true; name: string }
  | { ok: false; error: string }

export async function registerUser(
  name: string,
  phone: string,
  password: string,
): Promise<AuthResult> {
  const db = await getDb()
  const normalizedPhone = phone.trim()
  const existing = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM users WHERE phone = ?',
    [normalizedPhone],
  )
  if (existing) {
    return { ok: false, error: 'Bu telefon numarası zaten kayıtlı.' }
  }
  const passwordHash = await hashPassword(password)
  await db.runAsync(
    'INSERT INTO users (id, name, phone, password_hash, created_at) VALUES (?, ?, ?, ?, ?)',
    [uid(), name.trim(), normalizedPhone, passwordHash, new Date().toISOString()],
  )
  return { ok: true, name: name.trim() }
}

export async function loginUser(
  phone: string,
  password: string,
): Promise<AuthResult> {
  const db = await getDb()
  const user = await db.getFirstAsync<{ name: string; password_hash: string }>(
    'SELECT name, password_hash FROM users WHERE phone = ?',
    [phone.trim()],
  )
  if (!user) {
    return { ok: false, error: 'Bu numaraya ait hesap bulunamadı. Önce kayıt olun.' }
  }
  const passwordHash = await hashPassword(password)
  if (passwordHash !== user.password_hash) {
    return { ok: false, error: 'Telefon veya şifre hatalı.' }
  }
  return { ok: true, name: user.name }
}
