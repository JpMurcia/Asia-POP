# SYSTEM DESIGN DOCUMENT (SDD): GENERADOR AUTOMATIZADO DE CATÁLOGOS PDF

**Proyecto:** Alegra Catalog Auto-Generator (React + Tailwind CSS + Puppeteer)
**Entorno de ejecución:** Microservicio Node.js (REST + CLI). n8n es opcional (ver sección 9)
**Flujo de desarrollo:** [GitHub Spec Kit](https://github.com/github/spec-kit) (`specify`) + Claude Code
**Referencia visual:** [`docs/Cat.pdf`](./Cat.pdf) (catálogo actual, 38 páginas, formato A4)
**Fecha:** 2026

---

## 0. FLUJO DE DESARROLLO (SPEC KIT + CLAUDE CODE)

Este documento es la **fuente de requisitos** para Spec Kit. El proyecto ya está inicializado con:

```bash
uv tool install specify-cli --from git+https://github.com/github/spec-kit.git
specify init --here --integration claude --script ps   # en versiones antiguas: --ai claude
```

Esto crea `.specify/` y los skills de Claude Code en `.claude/skills/`. Orden de trabajo recomendado:

1. `/speckit-constitution`: principios del proyecto (TypeScript estricto, sin secretos en logs, A4 fijo, etc.).
2. `/speckit-specify`: pasar las secciones 1, 3, 4 y 6 de este documento como descripción.
3. `/speckit-clarify`: resolver los puntos abiertos de la sección 10.
4. `/speckit-plan` → `/speckit-tasks` → `/speckit-implement`.

> Nota: "Spekit" en versiones anteriores de este documento se refería a Spec Kit. Es una herramienta de **desarrollo**, no un destino de ejecución del servicio.

---

## 1. RESUMEN EJECUTIVO Y VISIÓN GENERAL

Sistema que genera un **catálogo PDF** de ASIANPOP MARKET+ a partir de los datos en tiempo real de la **API de Alegra**, replicando el diseño de [`Cat.pdf`](./Cat.pdf).

Se usa **renderizado vía Headless Browser** (descartando librerías PDF de bajo nivel como `pdfkit`, que no soportan bien neón, tipografías personalizadas ni capas compuestas): las páginas se maquetan como vistas web con **React + Tailwind CSS** y se convierten a PDF con **Puppeteer**.

### Objetivos clave
1. **Configuración dinámica de Alegra:** gestionar, actualizar y validar las credenciales (correo y token) por endpoints REST, sin reiniciar la aplicación.
2. **Sincronización:** consumir productos y categorías de Alegra con las credenciales activas.
3. **Lógica de stock:** mostrar el indicador **AGOTADO** en productos sin inventario (ver `Cat.pdf`, secciones RAMEN a BEBIDAS).
4. **Paginación dinámica:** agrupar por categoría y maquetar **máximo 3 productos por página**, como en `Cat.pdf` (págs. 3-10 RAMEN, 12-14 TTEOKBOKKI, 16-17 SNACKS, 19-24 DULCES, 26-33 BEBIDAS).
5. **Integración:** exponer endpoints REST y CLI independientes, utilizables desde cualquier cliente (n8n, cron, curl, otro sistema).
6. **Visión futura (Template Builder):** componentes desacoplados parametrizables por un esquema JSON.

---

## 2. REFERENCIA VISUAL: `Cat.pdf`

Estructura real del catálogo de referencia (A4, 595 × 842 pt, 38 páginas):

| Páginas | Contenido | Origen de los datos |
| --- | --- | --- |
| 1 | Portada: "Catálogo de productos", banner "Domicilios", logo y teléfonos | Config estática |
| 2 / 11 / 15 / 18 / 25 / 34 | Portada de sección: RAMEN, TTEOKBOKKI, SNACKS, DULCES, BEBIDAS, MOCHIS | Categorías de Alegra (excepto MOCHIS) |
| 3-10, 12-14, 16-17, 19-24, 26-33 | Páginas de productos: foto, descripción, precio, badge AGOTADO | Items de Alegra |
| 33 | Ítem suelto "Palillos $800" (página con un solo producto) | Item de Alegra (caso de página incompleta) |
| 35-37 | **MOCHIS**: qué es el mochi, sabores (FRESA, ARANDANO, MANGO, DURAZNO con "imagen de referencia"), cajas x6 ($30.000) y x12 ($50.000) con máx. 2 y 4 sabores | **Sección propia** (no está en Alegra): producto bajo pedido, sin stock |
| 38 | Políticas: pedidos con 1 día de anticipación, sin stock inmediato, pagos (50 %) y cancelaciones | Contenido estático (`TermsPage`) |

Observaciones que el diseño debe respetar:
- Algunos precios llevan sufijo de presentación (`$5.000 Und`, `$15.000 x 27und`, `$600 und`). Decisión diferida hasta investigar la API (ver 10.1); mientras tanto se asume una presentación por ítem.
- La sección **MOCHIS no proviene de Alegra** (se produce bajo pedido). Debe modelarse como sección estática configurable.
- Las páginas pueden tener menos de 3 productos (p. 33).

---

## 3. ARQUITECTURA DE SOFTWARE

```text
        UI / n8n / cron / curl / CLI
                    |
     +--------------+------------------+
     |                                 |
     v                                 v
POST /api/v1/settings/alegra     POST /api/v1/catalog/generate
     |                                 |
     v                                 v
+--------------------+        +------------------------------+
| Config Manager     |------->| Alegra Adapter (Node.js)     |
| - Store cifrado    |        | - GET /item-categories       |
| - Test connection  |        | - GET /items (paginado)      |
| - Fallback a .env  |        | - Normaliza a CatalogPayload |
+--------------------+        +--------------+---------------+
                                             | CatalogPayload (JSON)
                                             v
                         +-----------------------------------+
                         | React + Tailwind (SSR a HTML)     |
                         | - 3 items/página, tema neón       |
                         | - Badge AGOTADO, portadas, footer |
                         | - Sección MOCHIS y políticas      |
                         +----------------+------------------+
                                          | HTML
                                          v
                         +-----------------------------------+
                         | Puppeteer (navegador reutilizado) |
                         | - A4, márgenes 0, fondos activos  |
                         +----------------+------------------+
                                          | PDF
                                          v
                         +-----------------------------------+
                         | Salida: disco local / URL / buffer|
                         +-----------------------------------+
```

---

## 4. MÓDULO DE CONFIGURACIÓN DINÁMICA DE LA API DE ALEGRA

Gestor de configuración en ejecución (*Runtime Config Manager*).

### 4.1. Flujo de credenciales
1. Se consultan las credenciales guardadas en el almacenamiento persistente (archivo cifrado o SQLite).
2. Si no existen, se usan como respaldo las variables del `.env`.
3. Un endpoint de prueba valida la conexión **antes** de guardar.

### 4.2. Seguridad (obligatorio)
- **Todos los endpoints `/api/v1/*` requieren autenticación** del servicio (header `X-API-Key` contra `SERVICE_API_KEY`). Sin esto, cualquiera con acceso a la red podría reemplazar las credenciales.
- El token de Alegra se guarda **cifrado** (AES-256-GCM, clave en `ENCRYPTION_KEY`).
- `GET /settings/alegra` **nunca** devuelve el token (ni parcial) y los logs deben enmascararlo.
- `POST /settings/alegra/test` tiene límite de intentos (rate limit) para evitar su uso como probador de tokens.

### 4.3. Endpoints

#### a) Guardar / actualizar credenciales
```http
POST /api/v1/settings/alegra
Content-Type: application/json
X-API-Key: <SERVICE_API_KEY>

{
  "email": "usuario@dominio.com",
  "apiToken": "tok_1234567890abcdef"
}
```
Valida la conexión y solo guarda si responde correctamente. (Se eliminó el campo `environment`: Alegra no ofrece un entorno sandbox por credenciales.)

#### b) Consultar estado
```http
GET /api/v1/settings/alegra
```
Retorna el correo registrado, `isConfigured` y `lastTestedAt` (sin token).

#### c) Probar conexión
```http
POST /api/v1/settings/alegra/test
Content-Type: application/json

{
  "email": "usuario@dominio.com",
  "apiToken": "tok_1234567890abcdef"
}
```
Hace una petición liviana a `GET /company` y responde si Alegra devuelve HTTP 200.

---

## 5. ESPECIFICACIÓN DE LA API DE ALEGRA Y MODELOS DE DATOS

> Los puntos marcados **(verificar)** deben confirmarse contra la documentación oficial de Alegra y un ítem real de la cuenta antes de implementar.

### 5.1. Autenticación HTTP Basic
- **Base URL:** `https://api.alegra.com/api/v1` **(verificar)**
- **Header:** `Authorization: Basic Base64(email:token)`
- **Content-Type:** `application/json`

### 5.2. Endpoints requeridos

| Recurso | Método | Endpoint (relativo a la base) | Propósito |
| --- | --- | --- | --- |
| Compañía | `GET` | `/company` | Validar credenciales. |
| Categorías | `GET` | `/item-categories` | Secciones (RAMEN, TTEOKBOKKI, SNACKS, DULCES, BEBIDAS). MOCHIS es estática. |
| Productos | `GET` | `/items?status=active&start=0&limit=30` | Productos activos con precio, imágenes e inventario. **Paginar** con `start` hasta agotar resultados (el máximo de `limit` suele ser 30 **(verificar)**; `limit=500` probablemente es rechazado). |

### 5.3. Reglas de transformación
- **Stock:** `isOutOfStock = true` si el ítem controla inventario y su cantidad disponible es `<= 0` (campo probable: `inventory.availableQuantity` **(verificar)**). Si el ítem **no controla inventario** (`inventory` ausente o servicio), se considera disponible (`isOutOfStock = false`).
- **Sin categoría:** se muestran como alerta en pantalla para asignarles sección (override local `ItemCategoryOverride`); mientras no tengan sección, quedan fuera del PDF (ver 10.1).
- **Categorías vacías:** se omiten (sin portada de sección).
- **Orden de secciones:** definido en configuración (`sectionOrder`), por defecto el del catálogo de referencia: RAMEN, TTEOKBOKKI, SNACKS, DULCES, BEBIDAS, MOCHIS. Dentro de cada sección, orden alfabético o por `sortIndex` configurable.
- **Imagen:** primera imagen del arreglo `images` del ítem **(verificar)**; si no hay, se usa `public/assets/placeholder.png`.
- **Precio:** formateado con `Intl.NumberFormat('es-CO')` y prefijo `$` (ej. `$9.000`).
- **Descarga de imágenes:** se descargan/cachean antes de renderizar (con timeout) para no depender de `networkidle0` con URLs externas.

### 5.4. DTO normalizado (`CatalogPayload`)

```typescript
export interface AlegraConfigDTO {
  email: string;
  isConfigured: boolean;
  lastTestedAt?: string;
  // El apiToken nunca se expone en DTOs de salida.
}

export interface ProductItem {
  id: string;
  name: string;
  description: string;
  price: number;
  formattedPrice: string;   // ej: "$9.000" (ver Cat.pdf)
  imageUrl: string;
  isOutOfStock: boolean;    // ver 5.3
  categoryName: string;
  categoryId: string;
}

export interface CatalogSection {
  categoryId: string;
  categoryName: string;     // ej: "RAMEN", "TTEOKBOKKI"
  source: 'alegra' | 'custom'; // secciones propias (MOCHIS, REGALOS): ver 10.2
  products: ProductItem[];
  pages: ProductItem[][];   // chunks de máximo 3 ítems (derivado de products)
}

export interface CatalogConfig {
  storeName: string;        // "ASIANPOP MARKET+"
  phoneContact1: string;    // "310 669 0585"
  phoneContact2: string;    // "318 807 0709"
  storeAddress: string;     // "Cra 10 # 18-15 centro"
  sectionOrder: string[];
  terms: string[];          // contenido de TermsPage (Cat.pdf, pág. 38)
  theme: {
    primaryColor: string;   // "#11052C"
    accentNeon: string;     // "#FF007A"
    fontFamily: string;
  };
}

export interface CatalogPayload {
  config: CatalogConfig;
  sections: CatalogSection[];
  generatedAt: string;
}
```

---

## 6. ESTRUCTURA DEL PROYECTO

```text
alegra-catalog-generator/
├── src/
│   ├── config/
│   │   ├── alegra-settings.store.ts  # Credenciales cifradas (archivo/SQLite)
│   │   └── env.config.ts             # Variables de entorno (fallback)
│   ├── alegra/
│   │   ├── alegra.client.ts          # Cliente HTTP (credenciales dinámicas, paginación)
│   │   ├── alegra.service.ts         # Mapeo, agrupación por categoría y paginación
│   │   └── alegra.types.ts           # Tipos raw de Alegra
│   ├── controllers/
│   │   ├── settings.controller.ts
│   │   └── catalog.controller.ts
│   ├── components/
│   │   ├── CoverPage.tsx             # Portada (Cat.pdf pág. 1)
│   │   ├── SectionHeader.tsx         # Portada de categoría (págs. 2, 11, 15, 18, 25, 34)
│   │   ├── ProductCard.tsx           # Foto, badge AGOTADO, precio, descripción
│   │   ├── CatalogPage.tsx           # Página A4 (máx. 3 ProductCards)
│   │   ├── CustomSectionPages.tsx    # Secciones propias: mochis, combos (págs. 35-37)
│   │   ├── FooterInfo.tsx            # Teléfonos y domicilio
│   │   └── TermsPage.tsx             # Políticas (pág. 38)
│   ├── renderer/
│   │   ├── pdf.service.ts            # Orquestador de Puppeteer
│   │   └── template.engine.tsx       # React SSR -> HTML
│   ├── builder/
│   │   ├── template.schema.ts        # Esquema JSON (fase futura)
│   │   └── theme.config.ts
│   ├── server.ts                     # Servidor Express
│   └── index.ts                      # CLI runner
├── public/assets/                    # Logo, badge AGOTADO, placeholder
├── tests/
├── .env.example
├── Dockerfile
├── package.json
├── tailwind.config.js
└── tsconfig.json
```

---

## 7. PLAN DE IMPLEMENTACIÓN POR FASES

### FASE 1: Configuración de Alegra y adaptador
1. `alegra-settings.store.ts`: guardar y recuperar credenciales cifradas.
2. `settings.controller.ts`: `POST/GET /api/v1/settings/alegra` y `POST .../test`, con autenticación `X-API-Key`.
3. `AlegraClient`: lee la configuración vigente en cada petición, pagina con `start`/`limit` y maneja errores 401/429.
4. `fetchCatalogData()`: consulta `/items?status=active` (paginado) y `/item-categories`.
5. Reglas de la sección 5.3 (stock, sin categoría, orden, imagen, precio).
6. Subdividir productos de cada categoría en bloques de **máximo 3** por página.
7. **Tests** con mocks de Alegra: categorías con 0, 1, 3 y 4 productos; ítem sin `inventory`; ítem sin categoría; paginación de más de una página.

### FASE 2: Maquetación React + Tailwind
Calcar la estética de `Cat.pdf` (fondo oscuro neón, encabezados estilo K-Pop/Asian store, badge AGOTADO, A4 estricto).
- **Hoja A4 fija:** `w-[210mm] h-[297mm] overflow-hidden break-after-page` y `@page { size: A4; margin: 0 }` en el CSS global.
- **Estilo neón:** fondo `#11052C` o gradientes morados; sombras `shadow-[0_0_15px_rgba(255,0,122,0.5)]`; neón verde/naranja en títulos.
- **Layout por hoja:** 3 tarjetas alineadas verticalmente; cada una con imagen, nombre, descripción, precio flotante (`$9.000`, `$15.000`) y badge diagonal **AGOTADO** si `isOutOfStock`.
- **Páginas especiales:** portada, portadas de sección, secciones propias (MOCHIS, combos) y página de políticas (ver sección 2).
- **Fuentes:** incluidas localmente (no depender de CDN) y declaradas en el `Dockerfile`.

### FASE 3: Renderizado PDF (Puppeteer)
1. `react-dom/server` (`renderToString`) para generar el HTML.
2. Inyectar el CSS de Tailwind compilado (build previo, no CDN).
3. Puppeteer con **navegador reutilizado** (una instancia, una página por solicitud, `try/finally` para cerrar la página):

```typescript
import puppeteer, { Browser } from 'puppeteer';

let browser: Browser | undefined;

async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.connected) {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }
  return browser;
}

export async function generatePdfFromHtml(html: string): Promise<Buffer> {
  const page = await (await getBrowser()).newPage();
  try {
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 60_000 });
    await page.evaluateHandle('document.fonts.ready');
    const pdf = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true, // el tamaño A4 lo define @page en el CSS
    });
    return Buffer.from(pdf);
  } finally {
    await page.close();
  }
}
```

### FASE 4: Endpoints de generación

```http
POST /api/v1/catalog/generate
Content-Type: application/json
X-API-Key: <SERVICE_API_KEY>

{
  "categories": ["RAMEN", "SNACKS"],
  "hideOutOfStock": false,
  "customBannerText": "Catálogo Actualizado 2026",
  "theme": { "primaryColor": "#11052C" },
  "mode": "sync"
}
```

- `categories` (opcional): filtra secciones.
- `hideOutOfStock` (opcional, por defecto `false`): `true` oculta los agotados; `false` los muestra con badge.
- `mode`: `sync` devuelve `application/pdf` directamente; `async` devuelve `202 { "jobId": "..." }` y se consulta con `GET /api/v1/catalog/jobs/:id`, que entrega estado y URL del archivo. Recomendado para catálogos grandes (descarga de imágenes + Chromium) y clientes con timeout corto.
- Archivo resultante guardado en disco (`output/catalogo-YYYY-MM-DD.pdf`).

También por CLI: `npm run generate -- --categories RAMEN,SNACKS`.

### FASE 5: Template Builder (futuro)

```typescript
export interface CustomTemplateSchema {
  id: string;
  name: string;
  layout: {
    itemsPerPage: number;   // por defecto 3
    columns: number;        // por defecto 1
    showStockBadges: boolean;
  };
  styles: {
    backgroundColor: string;
    cardBackgroundColor: string;
    primaryTextColor: string;
    accentNeonColor: string;
    priceTagBg: string;
    fontFamily: string;
  };
  branding: {
    logoUrl: string;
    headerPhones: string[];
    showFooter: boolean;
  };
  customCSS?: string;
}
```

Los componentes de la Fase 2 reciben este esquema como `props` opcionales.

---

## 8. VARIABLES DE ENTORNO (`.env`)

```bash
# Servidor
PORT=3000
NODE_ENV=production
SERVICE_API_KEY=cambia-esta-clave        # autenticación de los endpoints /api/v1/*
ENCRYPTION_KEY=clave-de-32-bytes-en-base64  # cifrado del token de Alegra

# Credenciales de respaldo (opcionales si se configuran por API)
ALEGRA_EMAIL=usuario_fallback@dominio.com
ALEGRA_API_TOKEN=tok_fallback123456789

# Datos del negocio por defecto
STORE_NAME="ASIANPOP MARKET+"
PHONE_CONTACT_1="310 669 0585"
PHONE_CONTACT_2="318 807 0709"
STORE_ADDRESS="Cra 10 # 18-15 centro"

# Puppeteer
PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
```

---

## 9. OPTIMIZACIONES Y COMPONENTES OPCIONALES

- **n8n no es necesario.** El servicio ya expone REST y CLI. n8n solo aporta valor si se quiere automatizar *después* de generar (enviar el PDF por WhatsApp o correo, subirlo a Drive). Para regenerar periódicamente basta `node-cron` dentro del servicio o una tarea programada del sistema operativo. Recomendación: **no incluir n8n en el MVP**.
- **Un solo proceso con SQLite embebido** (credenciales cifradas, secciones/productos propios y overrides). Evitar PostgreSQL/Vault.
- **Almacenamiento:** disco local es suficiente; S3 solo si el PDF se distribuye públicamente.
- **Un solo motor de PDF:** elegir Puppeteer y no mantener Playwright en paralelo.
- **Caché de datos de Alegra** (TTL de 5-10 min) para respetar el rate limit y acelerar regeneraciones.
- **React SSR:** válido y útil para el Template Builder futuro. Si este no se concreta, bastaría con plantillas HTML simples; mantener React solo si la Fase 5 está confirmada.
- **Endpoints de settings:** si el servicio solo lo usa una persona, la configuración por `.env` + un comando CLI (`npm run set-credentials`) sería más simple. Se mantiene el endpoint porque fue un requisito explícito.

---

## 10. DECISIONES Y PUNTOS ABIERTOS

### 10.1. Clarificaciones (sesión 2026-10-02)

- **Presentaciones y precios múltiples** (`$5.000 Und`, `$15.000 x 27und`, `$600 und` en `Cat.pdf`): decisión **diferida**. Se define cuando se investigue la API de Alegra (si cada presentación es un ítem distinto o una variante/lista de precios). Hasta entonces, el modelo asume una presentación por ítem.
- **Ítems sin categoría:** no se omiten ni se envían a "OTROS" en silencio. El sistema los **muestra en pantalla como alerta** para asignarles una categoría/sección antes de generar el catálogo.
  - Una asignación hecha en nuestro sistema se guarda como **override local** (`itemId → sección`) y se aplica al generar el PDF.
  - **Investigación futura (fuera del MVP):** ¿se puede actualizar la categoría del ítem en Alegra desde nuestro sistema (`PUT /items/{id}`)? Mientras tanto, la alerta sirve de recordatorio para corregirlo en Alegra.
- **Productos que no existen en Alegra** (MOCHIS y similares): el sistema debe incluir una **sección de contenido propio**, administrable por el usuario, que permite **crear, editar y eliminar** productos y categorías que no están en Alegra. Estos entran al catálogo PDF junto con los de Alegra. Tipos:
  - **Elaborados / bajo pedido** (ej. mochis): sin stock, sin badge AGOTADO, con sabores, tamaños y reglas propias (`Cat.pdf`, págs. 35-37).
  - **Paquetes o combos de regalo:** compuestos por varios productos (de Alegra o propios), con **precio de combo o descuento** sobre la suma de sus componentes.

### 10.2. Impacto en el modelo de datos

Se agrega al `CatalogPayload` (sección 5.4) lo siguiente; sustituye al marcador `source: 'static'` previo:

```typescript
export type ProductSource = 'alegra' | 'custom';

export interface CustomProduct {
  id: string;                  // id local (uuid)
  sectionId: string;
  name: string;
  description: string;
  imageUrl?: string;
  price?: number;              // precio fijo; opcional si usa options
  options?: { label: string; price: number }[]; // ej. "Caja x 6 UND" $30.000
  flavors?: string[];          // ej. FRESA, ARANDANO, MANGO, DURAZNO
  maxFlavorsByOption?: Record<string, number>;  // ej. x6 -> 2, x12 -> 4
  trackStock: false;           // los elaborados no usan stock
}

export interface BundleProduct {
  id: string;
  sectionId: string;
  name: string;
  description: string;
  imageUrl?: string;
  components: { source: ProductSource; productId: string; quantity: number }[];
  pricing: { type: 'fixed'; price: number } | { type: 'discount'; percent: number };
  // El precio con descuento se calcula sobre la suma de los componentes de Alegra
}

export interface CustomSection {
  id: string;
  name: string;                // ej. "MOCHIS", "REGALOS"
  order: number;
  products: (CustomProduct | BundleProduct)[];
}

export interface ItemCategoryOverride {
  alegraItemId: string;
  sectionId: string;           // asignación local para ítems sin categoría
}
```

Consecuencias:
- Se requiere **persistencia local** para secciones, productos propios y overrides: **SQLite** (reemplaza la opción de archivo JSON para este dato) y endpoints `CRUD /api/v1/custom-sections`, `/custom-products`, `/bundles` y `GET /api/v1/catalog/uncategorized`.
- Un **combo** que incluya un ítem de Alegra sin stock debe marcarse como no disponible (regla a confirmar).
- La pantalla de administración (sección y productos propios, ítems sin categoría) es **parte del alcance**, no solo la API. El sistema deja de ser únicamente un microservicio y necesita UI de gestión mínima.
- `MochiPages.tsx` pasa a ser un renderizador **genérico** de secciones propias (`CustomSectionPages.tsx`), con el contenido de mochis cargado como dato inicial (seed).

### 10.3. Puntos abiertos

1. **Campos reales de Alegra:** confirmar nombres de stock, imágenes y paginación con un ítem real de la cuenta.
2. **Presentaciones en Alegra:** pendiente de la investigación de la API (ver 10.1).
3. **Actualizar categoría en Alegra desde el sistema:** investigar permisos y endpoint (ver 10.1).
4. **Combos:** ¿descuento porcentual, precio fijo o ambos? ¿Cómo se comporta si un componente está agotado?
5. **Ítems sin imagen:** ¿placeholder o se omite el ítem?
6. **Frecuencia de generación:** ¿bajo demanda o programada? Define si hace falta `node-cron` o el modo `async`.
7. **Dónde se ejecuta:** máquina local, VPS o contenedor (afecta Dockerfile y ruta de Chrome).
8. **Autenticación de la UI de administración:** usuario único con login o solo acceso local.

---

## 11. INSTRUCCIONES PARA LA EJECUCIÓN CON CLAUDE CODE

Orden estricto, usando los skills de Spec Kit (sección 0):

1. **Inicializar el proyecto:** `package.json` con `express`, `react`, `react-dom`, `puppeteer`, `tailwindcss`, `dotenv`, `typescript`, `@types/node`, `@types/react`.
2. **Configuración dinámica:** `settings.controller.ts` y `alegra-settings.store.ts` (con autenticación y cifrado).
3. **Cliente Alegra:** `alegra.client.ts` con paginación y mapeo a `CatalogPayload`.
4. **Componentes React:** páginas A4 en `src/components/` según la sección 2, con imagen, badge AGOTADO, precios `$9.000`, secciones propias (MOCHIS, combos), alerta de ítems sin categoría y políticas.
5. **Motor Puppeteer:** `pdf.service.ts` con `printBackground: true` y navegador reutilizado.
6. **Servidor Express:** endpoints de configuración y `/api/v1/catalog/generate`.
7. **Validación visual:** comparar el PDF generado contra [`Cat.pdf`](./Cat.pdf) página por página.
