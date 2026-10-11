# Validación: Productos del catálogo más claros y datos de Alegra guardados

**Feature**: `007-product-layout-alegra-cache` | **Fecha**: 2026-10-10 | **Entorno**: Alegra **simulado** (200 artículos, 20 categorías, 150 ms por respuesta, `MOCK_LOG=1`); servidor con carpeta de datos temporal. **No se tocó la cuenta real** de Alegra.

Este documento dice, escenario por escenario del [quickstart](./quickstart.md), qué se comprobó, cómo y qué queda pendiente. «Manual» es lo que se hizo a mano en el navegador o contra el servidor de prueba; «automática» es una prueba que corre en la suite. No incluye nombres de productos reales, direcciones firmadas ni credenciales.

## Resumen

- **Suites automáticas**: ver [«Pruebas»](#1-pruebas-automáticas) abajo (todas en verde).
- **Manual con el simulador**: tamaño de zona y foto, nombre en neón junto a `docs/Cat.pdf`, descarga única con avance, abrir las cuatro pantallas sin peticiones nuevas, reinicio, Alegra apagado, `prepare` sin PDF, conexión sin copia (pantalla de carga), categorías con 20 etiquetas largas, panel de Consejos a 1024 px y 1366 px, generación de 91 páginas.
- **Pendiente de la persona responsable** (no se puede dar por cumplido sin ella): aprobación del aspecto del nombre en neón frente a `docs/Cat.pdf` (SC-002), encontrar «Consejos» sin ayuda en menos de 10 s (SC-010), y todo lo de la **cuenta real** (escenario 10: se hace solo con su confirmación).

## 1. Pruebas automáticas

Resultados de la corrida final (comandos de la raíz):

| Comando | Resultado |
| --- | --- |
| `npm test -w backend` | 60 archivos, **951 pruebas en verde** |
| `npm test -w frontend` | 25 archivos, **684 pruebas en verde** |
| `npm run test:pdf` (Chrome real) | 26 pruebas en verde (PDF real: páginas, texto, fidelidad de Neón Noche, nombre separado) |
| `npm run lint` | sin errores ni advertencias |
| `npm run typecheck -w backend` y `npm run build` | sin errores |

Lo nuevo de esta feature está cubierto por: `layout-rows.test.ts` (geometría, límites, rótulo), `template-schema` / `template-presets` / `template-migration` (campos y normalización), `alegra-data-repo`, `alegra-data-service`, `alegra-data` (rutas y que abrir pantallas no consulta a Alegra), `panel-summary`, `print-overflow` y `pdf-render` (Chrome real: nombre separado, texto completo, avisos), `panel-layout` (1366 × 768 y 1024 px), y en el frontend `template-editor-reducer`, `template-editor-inspector`, `template-page`, `use-fit`, `text-overflow`, `generate`, `alegra-data-bar`, `loading-screen`, `articles`, `tips-panel`.

## 2. Tamaño de la zona y de la foto (Historia 1) — manual + automática

- La primera sección del inspector del bloque de productos es **«Tamaño de los productos»**, con «Zona de productos» y «Tamaño de la foto» (Ancho % y Alto % cada una), la nota de «Desbloquear» y «Restaurar tamaños originales»; no hace falta desbloquear el bloque para cambiar la zona (manual a 1366 × 768).
- Ancho de la foto en 70: las tres fotos se achican y la burbuja, el rótulo y el precio no se mueven.
- Alto de la foto en 150: queda en **107 %** (el máximo en Neón Noche con el nombre separado) con la nota «El alto máximo de la foto en esta zona es 107 %. Agranda el alto de la zona para darle más espacio.» y el aviso temporal.
- Zona mínima (40 % × 30 %), «Restaurar tamaños originales» en un solo paso de deshacer, las tres distribuciones y que cambiar la zona o la distribución no reescribe lo guardado: automáticas.
- Límites medidos (alternado: ancho hasta 150 %, alto ≈ 107–109 %; tarjetas: ancho ≈ 107 %, alto hasta 150 %; lista: ≈ 148–150 %).

## 3. Nombre separado frente a `Cat.pdf` (Historia 2)

- Capturas de la muestra de Neón Noche (`visual-sample.ts`) junto a la página 4 de `docs/Cat.pdf`: el nombre de cada producto va en un **rótulo oscuro con texto neón y resplandor**, fuera de la burbuja y de la foto; la burbuja trae solo la descripción; foto, burbuja y precio están donde estaban (SC-004).
- Con textos en el máximo (nombre de 120 caracteres, descripción de 2000): el nombre se reduce hasta 6 pt y se parte en líneas dentro del rótulo; la descripción se corta con «…».
- Nombre, descripción y orden de lectura del PDF real (Alegra, propio y combo): automática (`pdf-render`: el nombre sale antes que la descripción).
- Las otras tres plantillas conservan el nombre dentro de la burbuja (normalización al leer; la base de datos no cambia hasta que se guarda).
- **Pendiente**: que la persona responsable apruebe el aspecto (SC-002).

## 4. Avisos de texto que no cabe — automática

- Chrome real: un producto con nombre de 300 caracteres y descripción de 3500 se lista (nombre/burbuja) al terminar la generación y el PDF se genera igual; un producto normal no aparece (`print-overflow`).
- La cadena completa (vista de impresión → renderizador → trabajo → Generar) está probada: el trabajo entrega `textOverflow` y Generar muestra «N producto(s) tienen texto que no cabe completo» con enlace a Apariencia. En la generación de 91 páginas del simulador no hubo ninguno.

## 5. Datos de Alegra guardados (Historia 3)

| Punto del quickstart | Resultado |
| --- | --- |
| 1. Guardar la conexión descarga una vez, con avance | Manual: «Conectando con Alegra…» y luego «Datos de Alegra actualizados hace menos de 1 min.»; el simulador recibió una sola ronda (categorías + 7 páginas de artículos) |
| 2. Abrir Artículos, Sin categoría, Combos e Inicio no consulta | Manual: el registro del simulador no cambió al abrir las cuatro pantallas; por la API cada una responde en ≈ 0,2 s |
| 3. Reiniciar el servidor | Manual: tras reiniciar, el estado sigue «ready» con 200 artículos y 20 categorías y las pantallas responden sin descargar |
| 4. Precio viejo hasta «Actualizar» | Automática (`alegra-data.test.ts`): se ve lo guardado hasta pedir la actualización |
| 5. Alegra apagado + «Actualizar» | Manual: la actualización falla, `lastError` trae «No se pudo conectar con Alegra.», la lista y el resumen siguen mostrando los datos guardados con `syncError` |
| 6. Con Alegra apagado, «Preparar y revisar» falla y no hay PDF | Manual: `prepare` responde 502 `alegra_unreachable` y el historial queda vacío |
| 7. Preparar renueva la copia | Manual: tras preparar, `syncedAt` cambió; generar 91 páginas (189 productos) tardó 7,3 s en total y pesó 9,7 MB (Optimizada) |
| 8. Cambio de cuenta | Automática: otra cuenta descarta la copia y descarga la nueva; la misma cuenta no descarga; credenciales inválidas conservan credenciales y copia |
| 9. Conexión existente sin copia | Manual: se borró la fila, al abrir Artículos apareció la pantalla de carga, se descargó una vez y la lista se mostró |

## 6. Artículos de Alegra (Historia 4) — manual + automática

- Con la copia vacía aparece la pantalla de carga («Descargando los artículos de Alegra», «Conectando con Alegra…», indicador sin porcentaje y el esqueleto con el mismo espacio que la lista); con copia no aparece.
- Con 200 artículos y 20 categorías de nombre largo: 20 etiquetas + «Todas (200)» y «Sin categoría (11)», todas con su cantidad, que se acomodan en varias filas sin desbordar (`panel-layout` a 1366 y 1024 px). Combinación con búsqueda, vista «Omitidos» y «Limpiar filtros»: automática. Todo lo de la feature 006 sigue pasando (`articles.test.tsx`).

## 7. Consejos y diseño (Historia 5)

- El botón «Consejos» está en la barra superior, en Editor y en Plantillas, entre el estado de guardado y «Vista previa»; el panel tiene los 7 consejos, se cierra con «Cerrar», Esc y clic fuera, devuelve el foco al botón, contiene Tab y deja los atajos del editor en pausa; no toca el historial ni los cambios sin guardar (automática + manual a 1024 y 1366 px).
- A 1024 px la barra superior con el botón nuevo no cabía; se compactó (menos espacio, sin el título «Apariencia») y `panel-layout` lo comprueba.
- **Pendiente**: que una persona lo encuentre sin ayuda en menos de 10 s (SC-010).

## 8. Rendimiento (simulador con 150 ms por respuesta)

- Descarga inicial de 200 artículos: unos segundos (8 peticiones en serie de 150 ms), con avance visible.
- Pantallas con la copia: ≈ 0,2 s (sin consultar a Alegra).
- Preparar: 1,2 s (el simulador responde fotos al instante); generar y entregar 91 páginas: 7,3 s. No hay descargas extra por la copia: `prepare` guarda su propia descarga.

## 9. Regresión (001 a 006)

- Sin cambiar tamaños, la geometría de las filas es idéntica a la de antes (prueba contra una copia de la función anterior) y `pdf-template-fidelity` sigue en verde: mismas páginas, productos, precios y agotados.
- Las plantillas guardadas antes se abren, se guardan y se generan sin errores (`template-migration`); lista de omitidos, asignaciones de «Sin categoría» y combos funcionan con la copia.
- Alegra sigue en solo lectura: toda petición del simulador durante descargas, `prepare` y generación es `GET` (`alegra-data`, `security`).

## 10. Cuenta real

**No se ejecutó.** Requiere las credenciales de la persona responsable y descarga las fotos de su tienda a `data/image-cache/`; se hace sobre una copia de la carpeta de datos y solo con su confirmación (T083 de `tasks.md`).

## Cambios respecto del plan y de los contratos (decididos al implementar)

- El selector del nombre se llama **«Estilo del nombre»** (no «Estilo») para no chocar con el «Estilo» de los agotados; el subtítulo de la foto es **«Tamaño de la foto»**.
- Los campos de tamaño de la zona y de la foto se confirman con **Enter o al salir del campo**; así escribir «60» no pasa por «6» (que se recortaría y avisaría de un mínimo que aún no terminó de teclear).
- En `alternado`, la foto crece y se achica **hacia afuera**: su borde interior (el que toca la burbuja) no se mueve, así que burbuja, precio y rótulo no cambian de lugar al escalarla.
- El máximo de la foto es relativo a su tamaño original en la distribución, así que **no crece al agrandar la zona** (lo que crece es la foto en pantalla); la nota lo dice como «El … máximo de la foto en esta zona es N %».
- La nota de límite se muestra mientras el valor guardado está en su máximo (o lo supera) y se retira sola; sin nota no se dibuja nada.
- La burbuja de un producto con nombre separado se pinta justo después del rótulo y a su misma altura: en el PDF el nombre se lee antes que la descripción y el sello de AGOTADO no tapa ni uno ni otra.
- Las opciones de precio ganaron un último recurso propio (`--opt-lines`), porque al partirse en líneas dejaron de cortarse con «…».
- **Inicio** no tenía un botón «Actualizar» (solo «Reintentar» cuando Alegra falla); no se inventó uno: «Reintentar» ahora actualiza la copia y el aviso de actualización fallida trae su propio «Reintentar».
- `GET /api/alegra/data` y la barra cuentan los artículos recibidos solo en la fase de artículos; en la de categorías dicen «Conectando con Alegra…».
