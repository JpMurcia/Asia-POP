# Contrato: pantalla Generar, aviso de tamaño y Historial

**Feature**: `005-optimize-pdf-size` | **Base**: la pantalla Generar de 001–004 | **Idioma**: español (Colombia), sin términos técnicos (FR-001)

Los textos de este documento son los que debe mostrar la interfaz. Los de las dos calidades viven en el módulo puro `catalog/pdf-quality.ts` para que pantalla y pruebas usen los mismos.

## 1. Opción «Calidad del PDF» (Historia 1, FR-001, FR-002)

Va en la tarjeta **Opciones** de Generar, después de «Plantilla del catálogo» y antes de «Secciones a incluir», como un grupo de dos botones de opción (`fieldset` con `legend`), igual que el selector de plantilla.

| | |
| --- | --- |
| Leyenda | **Calidad del PDF** |
| Valores | Optimizada · Original (una sola selección) |
| Valor inicial | **Optimizada**, en cada visita a la pantalla y en cada generación (no se recuerda) |
| Cuándo se envía | Solo al pulsar «2. Generar PDF», dentro de la petición `generate` |

Textos de cada valor:

| Valor | Etiqueta | Ayuda (debajo de la etiqueta) |
| --- | --- | --- |
| `optimized` | **Optimizada** · Recomendada | Archivo mucho más liviano, ideal para enviar por correo o mensajería. Las fotos se ven igual a tamaño normal. |
| `original` | **Original** | Conserva las fotos tal como están en Alegra. El archivo puede ser varias veces más grande. |

Texto de pie del grupo: «Solo cambia esta generación.»

**Comportamiento**
- Cambiar la calidad **no** vuelve a preparar el catálogo ni cambia la revisión, las secciones, la estructura ni el enlace «Ver vista previa» (FR-001): no dispara ninguna petición.
- El grupo se deshabilita mientras hay un trabajo en curso, igual que el botón de preparar.
- Estilo y espaciado: los del selector de plantilla (mismos componentes de `ui`, tokens del tema).

## 2. Progreso (FR-013)

Con Optimizada, la tarjeta de progreso muestra primero el paso **«Optimizando fotos»** (barra de 5 a 30 %) y luego «Renderizando páginas». Con Original, el flujo es el de hoy.

## 3. Resultado y aviso (Historia 2, FR-011, FR-012)

Al terminar con éxito, la alerta de éxito pasa de «Catálogo generado. Descargar PDF» a:

> **Catálogo generado · 18,4 MB.** Descargar PDF

- El tamaño usa `formatMegabytes`: un decimal y coma (`18,4 MB`); la unidad es 1.048.576 bytes.
- Si el trabajo no trae `sizeBytes` (respuesta de un servidor anterior), se muestra solo «Catálogo generado. Descargar PDF», como hoy.

**Aviso de tamaño** (FR-012): se muestra **debajo** de la alerta de éxito, como alerta de advertencia, solo si `quality === 'optimized'` **y** `sizeBytes > 25 MB`:

> **El PDF pesa 31,2 MB y supera los 25 MB que admite un correo habitual.** Para hacerlo más liviano, genera de nuevo con menos secciones.

- No impide descargar y no abre ningún cuadro de diálogo.
- Con calidad Original **no** hay aviso: la persona eligió el archivo grande.
- Con un PDF de exactamente 25 MB o menos, no hay aviso.

## 4. Historial (Historia 2, FR-011, SC-005)

La tabla gana la columna **Tamaño**, entre «Páginas» y «Incluidos»:

| Fecha | Páginas | **Tamaño** | Incluidos | Omitidos | |
| --- | --- | --- | --- | --- | --- |
| 4/10/2026, 6:32 p. m. | 66 | **18,4 MB** | 182 | 14 | Descargar |
| 3/10/2026, 9:10 a. m. | 4 | **—** | 11 | 0 | Descargar |

- Una entrada sin `sizeBytes` (archivo borrado o ilegible) muestra «—».
- Se alinea como las demás columnas numéricas (texto, no alineado a la derecha, igual que «Páginas»).

## 5. Vista previa y editor

Sin cambios. La vista previa y el editor piden el payload **sin** `?quality`, así que ven las fotos originales y siempre coinciden con lo que muestra Original. Lo que cambia entre calidades es solo el peso de las fotos incrustadas.

## 6. Accesibilidad y estados

- Los botones de opción llevan etiqueta asociada y se operan con teclado como cualquier grupo de radios; la ayuda está dentro de la misma etiqueta para que el lector de pantalla la lea.
- El aviso de tamaño usa el rol de alerta de la alerta de advertencia existente.
- Errores de generación: sin cambios (`No se pudo generar el PDF: …`).

## Pruebas de este contrato (frontend)

En `frontend/tests/generate.test.tsx` y `frontend/tests/screens.test.tsx`:
1. La opción aparece con Optimizada marcada.
2. Elegir Original y pulsar «Generar PDF» envía `quality: "original"`; sin tocar la opción, envía `"optimized"`.
3. Cambiar la calidad no llama a `prepare` ni a `…/options`.
4. Con un trabajo terminado de 19.320.118 bytes en Optimizada se lee «18,4 MB» y no hay aviso.
5. Con 32.700.000 bytes en Optimizada aparece el aviso con «31,2 MB»; con los mismos bytes en Original, no.
6. Sin `sizeBytes` se muestra el texto de antes.
7. El Historial muestra la columna Tamaño con el valor y «—» cuando falta.
