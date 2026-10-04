CREATE TABLE alegra_connection (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  email TEXT NOT NULL,
  token_encrypted BLOB NOT NULL,
  last_tested_at TEXT
);

CREATE TABLE business_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  store_name TEXT NOT NULL,
  phone_1 TEXT NOT NULL,
  phone_2 TEXT NOT NULL,
  address TEXT NOT NULL,
  cover_title TEXT NOT NULL,
  terms_json TEXT NOT NULL
);

CREATE TABLE section (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  intro_text TEXT
);

CREATE TABLE section_order (
  section_key TEXT PRIMARY KEY,
  position INTEGER NOT NULL UNIQUE
);

CREATE TABLE custom_product (
  id TEXT PRIMARY KEY,
  section_id TEXT NOT NULL REFERENCES section(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  image_path TEXT,
  price INTEGER,
  flavors TEXT,
  sort_index INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE product_option (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES custom_product(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  price INTEGER NOT NULL,
  max_flavors INTEGER
);

CREATE TABLE bundle (
  id TEXT PRIMARY KEY,
  section_id TEXT NOT NULL REFERENCES section(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  image_path TEXT,
  pricing_type TEXT NOT NULL CHECK (pricing_type IN ('fixed', 'discount')),
  fixed_price INTEGER,
  discount_percent REAL
);

CREATE TABLE bundle_component (
  id TEXT PRIMARY KEY,
  bundle_id TEXT NOT NULL REFERENCES bundle(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('alegra', 'custom')),
  product_id TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity >= 1)
);

CREATE TABLE category_override (
  alegra_item_id TEXT PRIMARY KEY,
  section_key TEXT NOT NULL
);

CREATE TABLE generated_catalog (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  file_path TEXT NOT NULL,
  included_count INTEGER NOT NULL,
  omitted_count INTEGER NOT NULL,
  params_json TEXT NOT NULL
);
