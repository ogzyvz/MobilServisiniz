-- OtoServis — SQLite şeması (mobil uygulamanın yerel veritabanı)
-- Uygulama (expo-sqlite) bu şemayı src/lib/db.ts içinde otomatik oluşturur.
-- Bu dosya belgeleme ve manuel kurulum içindir.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY NOT NULL,
  name          TEXT NOT NULL,
  phone         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,           -- SHA-256(salt:password)
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS customers (
  id      TEXT PRIMARY KEY NOT NULL,
  name    TEXT NOT NULL,
  phone   TEXT NOT NULL,
  address TEXT
);

CREATE TABLE IF NOT EXISTS vehicles (
  id          TEXT PRIMARY KEY NOT NULL,
  plate       TEXT NOT NULL,
  brand       TEXT NOT NULL DEFAULT '',
  model       TEXT NOT NULL DEFAULT '',
  year        TEXT NOT NULL DEFAULT '',
  color       TEXT NOT NULL DEFAULT '',
  fuel        TEXT NOT NULL DEFAULT '',
  chassis     TEXT NOT NULL DEFAULT '',
  km          TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'bekliyor',   -- bekliyor | islemde | tamamlandi
  created_at  TEXT NOT NULL,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS complaints (
  id         TEXT PRIMARY KEY NOT NULL,
  vehicle_id TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  text       TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS services (
  id         TEXT PRIMARY KEY NOT NULL,
  vehicle_id TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  price      REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS vehicle_products (
  id         TEXT PRIMARY KEY NOT NULL,
  vehicle_id TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  quantity   INTEGER NOT NULL DEFAULT 1,
  price      REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS stock_products (
  id       TEXT PRIMARY KEY NOT NULL,
  name     TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'diger',   -- yag | filtre | fren | lastik | elektrik | diger
  code     TEXT NOT NULL DEFAULT '-',
  price    REAL NOT NULL DEFAULT 0,
  stock    INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_vehicles_customer ON vehicles(customer_id);
CREATE INDEX IF NOT EXISTS idx_complaints_vehicle ON complaints(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_services_vehicle ON services(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_products_vehicle ON vehicle_products(vehicle_id);
