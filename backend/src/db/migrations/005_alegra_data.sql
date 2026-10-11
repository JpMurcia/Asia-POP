-- Feature 007: copia local de lo que Alegra devuelve (artículos y categorías), para que las pantallas no tengan que
-- descargarlo cada vez que se abren. Una sola fila; una descarga la reemplaza completa en una sentencia, así que nunca
-- queda una copia a medias. Nunca guarda credenciales ni direcciones de fotos (vencen): solo si el artículo tiene foto.
-- `account_email` es la cuenta a la que pertenecen los datos (en minúsculas): con otra cuenta se descartan.
-- `format` es la versión del contenido de los JSON: si no coincide con la del código, la copia se trata como ausente.
CREATE TABLE alegra_snapshot (
  id              INTEGER PRIMARY KEY CHECK (id = 1),
  account_email   TEXT    NOT NULL,
  synced_at       TEXT    NOT NULL,
  format          INTEGER NOT NULL,
  items_json      TEXT    NOT NULL,
  categories_json TEXT    NOT NULL
);
