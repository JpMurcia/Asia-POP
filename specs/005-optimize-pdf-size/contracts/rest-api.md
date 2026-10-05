# Contrato: cambios en la API REST

**Feature**: `005-optimize-pdf-size` | **Base**: las rutas de [001](../../001-catalog-pdf-generator/) y [003](../../003-catalog-template-editor/contracts/rest-api.md) y el informe de [004](../../004-fix-alegra-images/contracts/review-report.md)

Todos los cambios son **aditivos**: no se agrega ningún endpoint y ningún campo existente cambia de forma. Todo sigue exigiendo sesión.

## `POST /api/catalog/generate` (ampliado)

Cuerpo:

```json
{
  "prepareId": "…",
  "bundleDecisions": { "…": "keep" },
  "quality": "optimized"
}
```

| Campo | Regla |
| --- | --- |
| `quality` | Opcional. `"optimized"` o `"original"`. Ausente = `"optimized"` (FR-002) |

- Un valor distinto responde **422 `validation_error`**, el mismo que esta ruta ya devuelve ante un cuerpo inválido.
- La respuesta no cambia: `202 { jobId, template }`.
- Es la **única** manera de elegir la calidad: `POST /catalog/prepare` y `PUT /catalog/prepare/:id/options` no la reciben ni la devuelven (FR-001).
- Cambia el valor por defecto de quien no envía `quality`: la única interfaz que usa la ruta es la pantalla Generar, que siempre lo envía.

## `GET /api/catalog/jobs/current` (ampliado)

Mientras trabaja, el `step` puede ser **«Optimizando fotos»** (solo en calidad Optimizada, antes de «Renderizando páginas»), con `progress` entre 5 y 30.

Al terminar (`status: "done"`):

```json
{ "status": "done", "step": "Catálogo listo", "progress": 100, "catalogId": "…", "sizeBytes": 19320118, "quality": "optimized" }
```

| Campo nuevo | Garantía |
| --- | --- |
| `sizeBytes` | Longitud exacta del PDF entregado, en bytes |
| `quality` | La calidad con la que se generó |

En cualquier otro estado los campos no aparecen. Una generación fallida (`failed`) sigue sin entregar PDF ni entrada de historial, incluso si las copias reducidas se habían preparado (se borran).

## `GET /api/catalog/payload/:prepareId` (ampliado)

Sin parámetros: **igual que hoy** (vista previa, editor y cualquier otro uso).

Con `?quality=optimized`:

- Devuelve el mismo payload con **solo** las `imageUrl` reemplazadas por la dirección de la copia reducida de cada foto, cuando existe (`/media/pdf/<trabajo>/<archivo>`). Una foto sin copia conserva su dirección original.
- Si la preparación no tiene copias (no hay generación en curso, o ninguna foto se pudo reducir), devuelve el payload sin cambios.
- Cualquier otro valor de `quality` se ignora y se comporta como si no estuviera.
- No cambia el `410 prepare_expired`.

Lo usa **únicamente** el navegador de la generación: el servidor abre `/print/<prepareId>?quality=optimized` cuando preparó copias. Garantía de la spec (FR-005): el resto del payload (plantilla refrescada, textos, precios, `soldOut`, secciones y términos) es **idéntico** al de la calidad Original.

## `GET /api/catalog/history` (ampliado)

Cada entrada gana un campo opcional:

```json
{ "id": "…", "createdAt": "…", "includedCount": 182, "omittedCount": 14, "pages": 66, "sizeBytes": 19320118 }
```

- `sizeBytes`: tamaño del archivo guardado. **Se omite** si el archivo ya no existe o no se puede leer; la pantalla muestra «—».
- Las entradas anteriores a la feature lo muestran igual: el tamaño se lee del archivo, no de un dato guardado.

## `GET /media/pdf/:run/:file` (nuevo, transitorio)

Sirve una copia reducida durante una generación. Se monta con las demás rutas de `/media`, así que:

- exige sesión (el navegador de la generación usa su sesión temporal);
- `:run` y `:file` deben cumplir el filtro de nombres seguros que ya usan `/media/cache` y `/media/uploads` (`^[A-Za-z0-9._-]+$`); otro nombre responde `400 invalid_file`;
- un archivo que no existe responde `404 not_found` (por ejemplo, una copia ya borrada).

## Garantías

| Garantía | Cómo se comprueba |
| --- | --- |
| Alegra solo se consulta con `GET` y esta feature **no la consulta** | La prueba que exige que toda petición a Alegra sea `GET` (ya existe) cubre también la generación en ambas calidades |
| Ninguna respuesta incluye direcciones firmadas de fotos | Las copias son direcciones locales `/media/...`; la respuesta del trabajo y del historial solo lleva números y la calidad |
| Calidad Original = el PDF de hoy | La generación en `original` no prepara copias, no agrega `?quality` a la vista de impresión y la prueba compara su payload con el de antes |
| La generación en Optimizada sin fotos que reducir produce lo mismo que Original | Prueba con fotos que `optimizePhoto` rechaza (`null`) |
| No quedan copias en disco | Tras terminar (con éxito o con error), `data/pdf-photos/` queda vacía |
| Un solo trabajo a la vez | Regla de 001 sin cambios (`409 job_in_progress`) |

## Compatibilidad

- Un cliente que ignore los campos nuevos funciona igual.
- La pantalla Generar de este repositorio es el único cliente; se actualiza en la misma entrega.
