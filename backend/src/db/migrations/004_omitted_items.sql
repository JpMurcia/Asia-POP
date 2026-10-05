-- Feature 006: artículos de Alegra que la persona decidió dejar fuera del catálogo.
-- Solo local: nunca se escribe en Alegra. La clave es el identificador del artículo en Alegra.
-- Una fila cuyo artículo ya no está activo se conserva (no se muestra ni cuenta); si vuelve a estar activo, sigue omitido.
CREATE TABLE omitted_item (
  alegra_item_id TEXT PRIMARY KEY
);
