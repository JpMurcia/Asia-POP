# Research: Generador de Catálogo PDF

**Feature**: [spec.md](./spec.md) | **Fecha**: 2026-10-02

Resuelve las incógnitas técnicas del plan. Los hechos de la API de Alegra se contrastaron con la documentación pública (`developer.alegra.com`); lo que no pudo confirmarse queda marcado **(verificar con cuenta real)**.

## 1. API de Alegra

**Decisión**: cliente HTTP propio sobre `fetch` con autenticación Basic (`email:token`), paginación por `start`/`limit`, y filtros `status=active` en `/items`.

**Hechos confirmados en la documentación**
- `GET /items` acepta `start`, `limit` (máximo **30**), `status` y `category` (id de categoría).
- Campos de interés del ítem: `inventory` con `availableQuantity` y `quantity`, `trackInventory` (control de inventario), `images`, `category`, `type` (`simple`, `kit`, `variantParent`, `variant`) y múltiples listas de precio.
- `GET /item-categories` lista las categorías.
- Los errores devuelven JSON con código y mensaje; Alegra anunció un **nuevo formato de ID** (changelog "nuevo-formato-de-id"), por lo que los IDs se tratan siempre como **texto opaco**, nunca como números.

**Pendiente de verificar con cuenta real**: URL base (`https://api.alegra.com/api/v1`), ruta exacta del campo de inventario dentro del ítem, estructura de `images` (¿URL directa o descriptor?), forma del límite de peticiones (429) y si `price` viene como número o como lista.

**Impacto en presentaciones (pendiente diferido en la spec)**: el campo `type` indica que Alegra modela **variantes** (`variantParent`/`variant`) y **kits**. Esto es la base de la futura decisión sobre unidad vs. paquete; en esta versión cada ítem se trata de forma independiente y los `variantParent` se ignoran si tienen variantes listadas.

**Alternativas**: SDK de terceros (`alegra-python` es Python; no hay SDK oficial TypeScript) → descartadas.

## 2. Arquitectura de aplicación

**Decisión**: dos paquetes en el repositorio: `backend` (Node.js + Express + TypeScript) y `frontend` (React + Vite + Tailwind). El backend sirve el frontend compilado y expone la API en `localhost`.

**Rationale**: la constitución exige proceso local para Alegra, persistencia y PDF (principios III y VI); React corre en el navegador y no puede guardar secretos.

**Alternativas**: Next.js (framework completo, más complejidad de la necesaria); Electron (empaquetado de escritorio, innecesario si basta `localhost`).

## 3. Renderizado del PDF

**Decisión**: **la misma vista React se usa como vista previa y como página de impresión.** El backend arma un `CatalogPayload` (instantánea JSON), lo guarda por `jobId`, y Puppeteer abre `http://localhost:PORT/print/<jobId>?t=<token de un solo uso>`, espera fuentes e imágenes y exporta el PDF.

**Rationale**: elimina el SSR con `renderToString` y la inyección manual de Tailwind del SDD; lo que se ve en la vista previa es lo que se imprime (principio IV). Cumple la constitución: un solo motor de PDF.

**Detalles**
- `@page { size: A4; margin: 0 }`, `preferCSSPageSize: true`, `printBackground: true`.
- Cada página es un contenedor `210mm × 297mm` con `break-after: page`.
- Una instancia de navegador se reutiliza entre generaciones y se cierra en `finally`; la página se cierra siempre.
- Fuentes locales (incluidas en el frontend), sin CDN.

**Alternativas**: SSR a HTML string (duplica pipeline de CSS); `pdfkit`/`pdf-lib` (no soportan bien neón, sombras ni capas); Playwright (Puppeteer ya basta, un solo motor).

## 4. Imágenes

**Decisión**: antes de generar, el backend descarga cada imagen con **timeout de 10 s** y la guarda en una caché local (`data/image-cache/`), sirviéndolas desde el propio servidor. Si la descarga falla, el ítem se considera **sin imagen** y se omite (consistente con FR-012).

**Rationale**: evita que `networkidle0` se bloquee por URLs externas lentas y hace la generación reproducible.

## 5. Persistencia

**Decisión**: **SQLite** mediante `better-sqlite3` (síncrono, sin servidor), archivo `data/app.db`, con migraciones SQL numeradas.

**Alternativas**: JSON plano (sin integridad referencial para combos y secciones); PostgreSQL (infraestructura externa, viola principio VI).

## 6. Autenticación y secretos

**Decisión**
- Login de un usuario semilla: usuario y contraseña se leen de `SEED_USERNAME` / `SEED_PASSWORD` del `.env` local (ignorado por git). Comparación en tiempo constante; la contraseña no se cambia desde la app.
- Sesión: cookie `httpOnly`, `sameSite=strict`, sesión en memoria (reiniciar el servidor cierra sesión, aceptable para un solo usuario local).
- Límite de intentos de login (5 por minuto) para evitar fuerza bruta.
- Token de Alegra: cifrado **AES-256-GCM** con `ENCRYPTION_KEY` (32 bytes en base64) antes de guardarlo en SQLite.
- El servidor escucha únicamente en `127.0.0.1`.
- Los logs enmascaran cabeceras `Authorization` y el campo `apiToken`.

## 7. Generación y concurrencia

**Decisión**: trabajo único en memoria con estados `idle → preparing → rendering → done | failed`. El frontend consulta `GET /api/catalog/jobs/current` cada segundo. Un segundo intento mientras hay un trabajo activo recibe `409` (FR-031). El PDF resultante se guarda en `data/output/` y el historial se limita a los **últimos 10** (FR-032).

**Alternativas**: cola de trabajos (BullMQ/Redis) → infraestructura innecesaria; SSE/WebSocket → el sondeo basta para un solo usuario.

## 8. Flujo "preparar y revisar" antes de generar

**Decisión**: la generación tiene dos pasos. `POST /api/catalog/prepare` consulta Alegra, aplica las reglas y devuelve un **informe de revisión**: ítems sin categoría, ítems omitidos por falta de imagen, combos con componentes agotados y conteos. El usuario resuelve las decisiones (mantener o excluir cada combo agotado) y luego llama a `POST /api/catalog/generate` con esas decisiones.

**Rationale**: implementa las alertas de FR-016, FR-018, FR-012 y FR-025/026 sin estado oculto; la decisión de combos se aplica por generación (FR-026).

## 9. Pruebas

**Decisión**: **Vitest** en backend y frontend; **supertest** para la API; respuestas de Alegra simuladas con un servidor falso local (MSW o `nock`). Verificación del PDF: pruebas de integración que generan un PDF con datos de ejemplo y comprueban el número de páginas y el texto con `pdf-parse`; la comparación visual con `Cat.pdf` es revisión manual (criterio SC-008).

## 10. Rendimiento

200 productos = 7 llamadas a `/items` de 30 ítems, más categorías y descarga de imágenes en paralelo limitada (6 concurrentes). El renderizado de ~40 páginas A4 con Puppeteer toma segundos; el objetivo de 2 minutos (SC-002) se cumple con margen. El tiempo total está dominado por las imágenes.

## Resumen de incógnitas

| Incógnita | Estado |
| --- | --- |
| Límite de `limit` en Alegra | Resuelto: 30 |
| Campo de stock | Resuelto: `inventory.availableQuantity` + `trackInventory` |
| Formato de IDs | Resuelto: texto opaco |
| Base URL, forma de `images`, estructura de precio, comportamiento 429 | Verificar con cuenta real (Fase de implementación, primera tarea) |
| Presentaciones unidad/paquete | Diferido por decisión del usuario |
