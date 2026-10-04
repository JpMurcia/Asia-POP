-- Feature 003: plantillas del catálogo (editor visual).
-- Cada plantilla es un documento JSON versionado (paleta, tipografías y las cuatro páginas con sus elementos).
-- Las plantillas base se siembran en la primera lectura (TemplateRepo.ensureSeeded), no aquí: viven en código.
-- `catalog_theme` (feature 002) NO se toca: queda sin uso y solo alimenta la paleta de Neón Noche al sembrar.
CREATE TABLE catalog_template (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  base TEXT NOT NULL,
  position INTEGER NOT NULL,
  doc_json TEXT NOT NULL
);

-- Una sola fila (id = 1). `revision` sube en cada guardado de plantillas y en cada guardado de los datos del
-- negocio: es la marca de concurrencia entre pestañas.
CREATE TABLE template_workspace (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  default_template_id TEXT NOT NULL,
  revision INTEGER NOT NULL
);
