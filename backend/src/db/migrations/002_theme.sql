-- Feature 002: tema del catálogo (colores que el PDF dibuja con CSS).
-- Una sola fila (id = 1). Sin fila se usan los valores por defecto; "restaurar" borra la fila.
CREATE TABLE catalog_theme (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  background TEXT NOT NULL,
  accent1 TEXT NOT NULL,
  accent2 TEXT NOT NULL,
  accent3 TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
