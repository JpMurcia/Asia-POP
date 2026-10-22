# Inventario de campos del editor de Canva → Asia-POP

**Estado**: borrador · **Fecha**: 2026-10-14 · Complementa [canva-ui-mapping.md](./canva-ui-mapping.md)

> 🚧 **Provisional hasta medirlo con REA.** Ver [PENDIENTES-REA.md](./PENDIENTES-REA.md): REA es la base obligatoria de
> las mejoras y este documento se revisa contra sus mediciones.

> **Origen y confianza.** Este inventario **no** se midió en vivo: el contenedor no llega a `canva.com` ni a tu
> Vivaldi. Sale de la documentación pública de Canva y de guías de uso
> ([bordes y esquinas](https://www.canva.com/help/add-borders-round-corners/),
> [agregar elementos](https://www.canva.com/help/add-elements/),
> [plantillas](https://www.canva.com/design-school/resources/using-and-customizing-templates),
> [herramientas de edición, NSW Education](https://education.nsw.gov.au/teaching-and-learning/technology-for-learning/resources/professional-learning-resources/canva-for-education/canva-foundations/transcript-canva-editing-tools),
> [barra lateral, NSW Education](https://education.nsw.gov.au/teaching-and-learning/technology-for-learning/resources/professional-learning-resources/canva-for-education/canva-foundations/transcript-exploring-side-bar))
> y del conocimiento general del producto.
>
> - Los **nombres y la ubicación** de los controles cambian según la versión, el plan (Free/Pro) y el tipo de diseño.
> - Los **rangos numéricos** marcados con ⏳ se confirman con REA (runbook en el documento de mapeo).
> - 👑 = función de pago en Canva (Pro/Teams).

**Leyenda de la columna Asia-POP** (contra `frontend/src/pages/TemplateEditor/inspector-fields.ts`):
✅ existe · ⚠️ parcial o distinto · ❌ no existe.
**Valor**: qué tanto le sirve al catálogo de Asia-POP (Alta / Media / Baja / No aplica).

---

## 1. Barra superior

| Campo | Control en Canva | Opciones / valores | Asia-POP | Valor |
| --- | --- | --- | --- | --- |
| Menú Archivo | Menú desplegable | Crear diseño, Configuración de vista, Guardar, Historial de versiones, Descargar, Hacer copia, Mover a carpeta, Papelera | ⚠️ "← Menú" vuelve al panel | Media |
| Configuración de vista | Ítems con check (dentro de Archivo) | Mostrar reglas y guías (Mayús+R), Mostrar márgenes, Mostrar sangrado de impresión (*bleed*) | ❌ | **Alta** (impresión del catálogo) |
| Cambiar tamaño 👑 | Botón + diálogo | Tamaños predefinidos, personalizado (ancho × alto + unidad px/in/mm/cm), copiar y redimensionar | ❌ (A4 fijo) | Baja |
| Deshacer / rehacer | Botones de ícono | Ctrl+Z / Ctrl+Y (Ctrl+Mayús+Z) | ✅ 60 pasos | — |
| Estado de guardado | Ícono de nube | Guardando… / Todo guardado (autoguardado) | ⚠️ manual + indicador | Media |
| Título del diseño | Campo en línea | Texto libre | ✅ `ed-name` | — |
| Compartir | Botón primario + panel | Personas y permisos, enlace, Descargar, Imprimir, Presentar, Más | ⚠️ PDF en la pantalla Generar | Media |
| Descargar → Tipo de archivo | Select | PNG, JPG, PDF estándar, PDF para imprimir, SVG 👑, MP4, GIF | ⚠️ solo PDF | Baja |
| Descargar → Tamaño | Slider multiplicador | ⏳ (×0,5 a ×3 aprox., 👑 por encima de ×1) | ❌ | Baja |
| Descargar → Fondo transparente 👑 | Check | PNG | ❌ | Baja |
| Descargar → Comprimir archivo 👑 | Check | — | ✅ ya se optimiza (feature 005) | — |
| Descargar → PDF para imprimir | Checks | Marcas de corte y sangrado, Aplanar PDF, Perfil de color RGB / CMYK 👑 | ❌ | **Alta** si se manda a imprenta |
| Descargar → Seleccionar páginas | Multi-select | Todas / rango | ❌ (siempre todas) | Media |
| Presentar / Analítica / Comentarios | Botones | — | ❌ | No aplica |

## 2. Barra lateral (riel + cajón)

| Pestaña | Contenido del cajón | Campos del cajón | Asia-POP | Valor |
| --- | --- | --- | --- | --- |
| Diseño | Plantillas, Estilos (combinaciones de color y fuente), Disposición | Buscador, filtros, "Aplicar todas las páginas" | ✅ Plantillas + paletas sugeridas (Estilo) | — |
| Elementos | Formas, gráficos, fotos, videos, audio, tablas, marcos, cuadrículas, gráficas | Buscador, filtros (color, estático/animado, gratis/Pro), categorías | ⚠️ título, texto, insignia, 3 formas, imágenes fijas | Media |
| Texto | Añadir título / subtítulo / cuerpo, combinaciones de fuentes, texto dinámico | Buscador | ⚠️ dentro de Elementos | Baja |
| Marca 👑 | Kit de marca: logos, colores, fuentes | — | ✅ equivalente: paleta de 6 colores + par tipográfico + Datos del negocio | — |
| Subidos | Imágenes, videos y audio propios | Botón subir, carpetas | ❌ (imágenes predefinidas) | **Alta** (logo, fotos de promos) |
| Dibujar | Lápiz, marcador, resaltador, borrador | Color, grosor, transparencia | ❌ | No aplica |
| Proyectos | Otros diseños y carpetas | — | ✅ galería de plantillas | — |
| Apps | Integraciones de terceros | — | ❌ | No aplica |
| **Comportamiento del cajón** | Se cierra pulsando la pestaña activa o la flecha "<" | Ancho ⏳, animación ⏳ | ❌ fijo | Media |

## 3. Barra contextual por tipo de elemento

### 3.1 Comunes a todos los elementos

| Campo | Control | Opciones / valores | Asia-POP | Valor |
| --- | --- | --- | --- | --- |
| Posición → Organizar | Botones | Traer adelante, Enviar atrás, Al frente, Al fondo | ⚠️ en `Layers` (reordenar) | — |
| Posición → Alinear a la página | Botones | Arriba, Centro (V), Abajo, Izquierda, Centro (H), Derecha | ✅ (feature 007) | — |
| Posición → Pestaña Capas | Lista | Arrastrar para reordenar, todos/superpuestos | ✅ `Layers` | — |
| Posición → Avanzado | Números | Ancho, Alto, X, Y, Rotación (°), bloqueo de proporción | ⚠️ X/Y/Ancho/Alto en %; rotación en slider; sin bloqueo de proporción | Media |
| Transparencia | Slider + número | 0–100 | ✅ Opacidad 0–100 % | — |
| Bloquear | Toggle / menú | Bloquear, Bloquear solo posición | ⚠️ bloqueo simple | Baja |
| Copiar estilo | Botón (brocha) | Copia formato a otro elemento | ❌ | Media |
| Animar | Panel | Animaciones de entrada/salida | ❌ | No aplica (PDF) |
| Enlace | Campo URL | URL, página del diseño | ❌ | Media (enlaces clicables en el PDF: WhatsApp, Maps) |
| Duplicar / Eliminar | Botones | Ctrl+D / Supr | ✅ | — |
| Comentar, Info alternativa (alt) | Menú "…" | Texto libre | ❌ | Baja |
| Agrupar / Desagrupar | Botón (con multi-selección) | Ctrl+G / Ctrl+Mayús+G | ❌ | Media (requiere multi-selección) |
| Voltear | Menú | Horizontal, vertical | ❌ | Baja |

### 3.2 Texto

| Campo | Control | Opciones / valores | Asia-POP | Valor |
| --- | --- | --- | --- | --- |
| Fuente | Select con buscador y vista previa | Biblioteca completa + fuentes de marca | ⚠️ 6 familias + Título/Cuerpo de la plantilla | — (fuentes locales a propósito) |
| Tamaño de fuente | Número con − / + y lista | ⏳ (lista de presets; máximo alto) | ✅ slider (`RANGES.textSize`) | — |
| Color del texto | Selector: colores del documento, de marca, por defecto, selector libre, cuentagotas | Sólido o degradado | ✅ color de paleta o personalizado | — |
| Negrita / Cursiva | Toggles | Ctrl+B / Ctrl+I (según la familia) | ⚠️ Peso 400/600/700/900; sin cursiva | Media |
| Subrayado / Tachado | Toggles | Ctrl+U | ⚠️ Tachado ✅ (feature 007); sin subrayado | — |
| Mayúsculas | Toggle | aA / AA | ✅ | — |
| Alineación | Ciclo | Izquierda, Centro, Derecha, Justificado | ⚠️ sin Justificado | Baja |
| Lista | Ciclo | Viñetas, Numerada | ❌ | Baja |
| Espaciado → Letras | Slider | ⏳ (aprox. −200 a 800) | ✅ `ls` | — |
| Espaciado → Altura de línea | Slider | ⏳ (aprox. 0,5 a 2,5) | ✅ 0,8–2,5 (feature 007) | — |
| Espaciado → Ancla | Botones | Arriba, Centro, Abajo | ❌ | Media |
| Efectos → Estilo | Rejilla | Ninguno, Sombra, Elevar, Hueco, Separar, Contorno, Eco, Glitch, Neón, Fondo | ⚠️ Contorno ✅, Neón ✅ (`glow`); el resto ❌ | Media (Sombra y Fondo) |
| Efectos → parámetros | Sliders por efecto | Sombra: desplazamiento, dirección, desenfoque, transparencia, color. Fondo: redondez, separación, transparencia, color. Contorno: grosor, color | ⚠️ contorno (grosor y color), neón (color) | Media |
| Efectos → Forma | Opción | Ninguna, Curva (con curvatura ⏳ −100 a 100) | ❌ | Baja |

### 3.3 Formas

| Campo | Control | Opciones / valores | Asia-POP | Valor |
| --- | --- | --- | --- | --- |
| Tipo de forma | Biblioteca | Decenas (rect., círculo, triángulo, estrella, flechas, globos…) | ⚠️ Rectángulo, Círculo, Píldora | Media (estrella/estallido para "PROMO") |
| Color de relleno | Selector | Sólido o degradado, transparente | ✅ sólido o transparente | — |
| Estilo de borde | Botones + sliders | Sin borde, Sólido, Discontinuo, Punteado; grosor; **redondeo de esquinas** | ⚠️ sólido + grosor + esquinas (solo rect.) | Baja |
| Color del borde | Selector | — | ✅ | — |
| Texto dentro de la forma | Doble clic | Con todos los campos de Texto | ❌ (se usa Insignia) | — |

### 3.4 Líneas

| Campo | Control | Opciones / valores | Asia-POP | Valor |
| --- | --- | --- | --- | --- |
| Color, grosor, estilo | Selector + slider + botones | Sólido, discontinuo, punteado | ❌ | Media (divisores) |
| Inicio / fin de línea | Select | Ninguno, flecha, círculo, cuadrado, rombo (rellenos o vacíos) | ❌ | Baja |
| Tipo de línea | Select | Recta, en codo, curva | ❌ | Baja |

### 3.5 Imágenes

| Campo | Control | Opciones / valores | Asia-POP | Valor |
| --- | --- | --- | --- | --- |
| Reemplazar | Arrastrar encima | Desde Subidos o Elementos | ⚠️ select entre 5 imágenes fijas | **Alta** (con Subidos) |
| Recortar | Modo recorte | Libre y relaciones (1:1, 4:3, 16:9…), rotación | ⚠️ Ajuste Contener/Cubrir/Estirar | Media |
| Voltear | Menú | Horizontal, vertical | ❌ | Baja |
| Estilo de borde + redondeo | Panel *Stroke style* | Estilo, grosor, color, redondeo de esquinas | ⚠️ redondeo hasta círculo, sin borde | Media |
| Editar foto → Ajustar | Sliders (−100 a 100 ⏳) | Temperatura, Matiz, Brillo, Contraste, Altas luces, Sombras, Blancos, Negros, Intensidad, Saturación, Claridad, Viñeta | ❌ | Baja (el catálogo usa las fotos de Alegra) |
| Editar foto → Filtros | Rejilla + intensidad | Familias Natural, Cálido, Vívido, etc. | ❌ | Baja |
| Editar foto → Efectos | Rejilla | Sombras, Duotono, Desenfoque, Enfoque automático | ❌ | Baja |
| Eliminar fondo 👑 | Botón | — | ❌ | Media (fotos de producto) |
| Transparencia, Posición, Bloquear… | Ver comunes | — | ✅ / ⚠️ | — |

### 3.6 Marcos y cuadrículas

| Campo | Control | Opciones / valores | Asia-POP | Valor |
| --- | --- | --- | --- | --- |
| Forma del marco | Biblioteca | Círculo, polígonos, letras, dispositivos, polaroid | ⚠️ imagen con esquinas hasta círculo | Baja |
| Imagen dentro | Arrastrar; doble clic para reencuadrar | — | ❌ | Baja |
| Cuadrícula → Espaciado | Slider | ⏳ | ❌ | Baja |

### 3.7 Tablas y gráficas

| Campo | Control | Opciones / valores | Asia-POP | Valor |
| --- | --- | --- | --- | --- |
| Tabla: filas/columnas, combinar, color de celda, borde, espaciado | Menús contextuales | — | ❌ | Baja (los productos los arma el bloque automático) |
| Gráfica: datos, tipo, colores, etiquetas | Panel lateral | — | ❌ | No aplica |

## 4. Sin elemento seleccionado (página)

| Campo | Control | Opciones / valores | Asia-POP | Valor |
| --- | --- | --- | --- | --- |
| Color de fondo | Selector | Sólido o degradado | ✅ Color / Degradado (2 colores) | — |
| Imagen de fondo | Arrastrar imagen al fondo | — | ⚠️ 2 imágenes fijas | Media |
| Título de la página | Campo sobre la página | Texto | ⚠️ nombres fijos (Portada, …) | — |
| Acciones de página | Botones sobre la página | Subir, Bajar, Ocultar, Bloquear, Duplicar, Eliminar, Añadir página | ❌ (4 páginas fijas por diseño) | No aplica |
| Animación de página | Panel | — | ❌ | No aplica |

## 5. Pie del lienzo y vista

| Campo | Control | Opciones / valores | Asia-POP | Valor |
| --- | --- | --- | --- | --- |
| Notas | Panel | Texto por página | ❌ | Baja |
| Temporizador | Botón | — | ❌ | No aplica |
| Zoom | Slider + porcentaje + presets (Ajustar, Rellenar) | ⏳ (aprox. 10 %–500 %) | ✅ 20–200 % + Ajustar | — |
| Vista de páginas | Toggle | Desplazamiento / Cuadrícula / Miniaturas | ✅ tira de páginas + Vista previa | — |
| Pantalla completa | Botón | — | ⚠️ editor ya a pantalla completa | — |
| Reglas y guías | Mostrar con Mayús+R; arrastrar guía desde la regla | Guías personalizadas, Añadir guías (columnas/filas, margen, separación) | ❌ (solo guías al centro) | Media |
| Ajuste a otros elementos | Automático | Bordes, centros, espaciado igual entre elementos | ⚠️ solo centro de la página | Media |

---

## 6. Resumen: qué vale la pena traer a Asia-POP

Ordenado por **valor para el catálogo ÷ costo**. Todo es una línea más en `inspector-fields.ts`, salvo lo marcado.

| # | Campo | Por qué | Costo |
| --- | --- | --- | --- |
| 1 | ✅ **Altura de línea** (texto) — feature 007 | Los textos de varias líneas hoy no se pueden ajustar | Bajo: un `range` y una propiedad en el modelo |
| 2 | ✅ **Alinear a la página** (6 botones) — feature 007 | Centrar con precisión sin arrastrar | Bajo: acción en el reductor |
| 3 | ✅ **Tachado** (texto) — feature 007 | Precio anterior en promociones | Bajo |
| 4 | **Sombra y Fondo** como efectos de texto | Legibilidad sobre fotos | Medio (render en `TemplatePage` y PDF) |
| 5 | **Subidos** (logo y fotos propias) | Hoy solo hay 5 imágenes fijas | Medio-alto: almacenamiento local, ya hay `multer`/`sharp` |
| 6 | **PDF para imprimir**: sangrado y marcas de corte | Si el catálogo va a imprenta | Medio (Puppeteer + márgenes) |
| 7 | **Enlaces** en elementos | WhatsApp y Maps clicables en el PDF | Bajo-medio |
| 8 | Bloqueo de proporción, copiar estilo | Comodidad | Bajo |
| — | Animar, Dibujar, Apps, Presentar, gráficas, filtros de foto | No aportan a un PDF de catálogo | Fuera de alcance (constitución VI) |

Cada campo nuevo que afecte el render debe dibujarse igual en el lienzo y en el PDF, porque los dos usan `TemplatePage` (constitución IV). Eso ya ocurre si la propiedad se lee dentro de ese componente.

---

## 6 (revisada con REA, 2026-10-22). Qué vale la pena traer a Asia-POP

Criterio: el catálogo se imprime como PDF, el editor lo usa una sola persona y ya tiene riel lateral, cajones,
tira de páginas, zoom, capas y consejos. Se traen **patrones y medidas**, nunca assets ni textos de Canva. Evidencia en
`docs/specs/rea-evidence/README.md`.

### Sí, en orden de valor

| # | Idea (medida en Canva) | Hoy en Asia-POP | Decisión |
| --- | --- | --- | --- |
| 1 | Interlineado 0,5–2,5 (paso 0,01), interletrado más amplio, anclaje de la caja, todo en «Configuración avanzada» | Interlineado 0,8–2,5; espaciado −2…12; sin anclaje | **Feature 008** (ya especificada) |
| 2 | Selector de color que ofrece primero **los colores que ya usa la plantilla**, con buscador por nombre o hex y cuentagotas | Selector de color simple por propiedad | **Feature 009**: alto valor, mantiene la marca coherente entre elementos |
| 3 | Selector de fuente con **cada nombre dibujado en su propia fuente**, buscador y lista de las usadas | Lista de texto plano con 6 familias | **Feature 009** (junto al color): bajo costo y mejora clara |
| 4 | **Estilos de texto predeterminados** (título, subtítulo, cuerpo) para insertar texto ya formateado | Se agrega un texto genérico | Candidata 010 |
| 5 | **Sombra y fondo del texto** como efectos con vista previa en cuadrícula | Contorno y resplandor | Candidata 010; exige tocar el render del PDF con su línea base |
| 6 | Transparencia de 0 a 100 (entero) con campo numérico | Opacidad de 0 a 1 | Solo rotular de 0 a 100 en pantalla; sin cambiar lo guardado |
| 7 | Atajos de zoom (300…10 %) en una lista | Botones acercar, alejar y ajustar | Menor: añadir la lista de porcentajes |

### No, por ahora

- **Animar, Presentar, Dibujar, Apps, Texto mágico, Quitafondos, Curvar texto, Colaboración y comentarios**: no aportan a
  un catálogo en PDF.
- **Kit de marca de pago y Archivos subidos como biblioteca**: la marca de Asia-POP ya vive en los ajustes de la
  aplicación; subir imágenes propias sigue siendo una candidata aparte (logo y fotos).
- **Un solo botón de alineación que cicla**: ahorra espacio pero modifica el elemento a cada clic (lo comprobó la
  prueba). Los botones separados de Asia-POP son más claros.
- **Cuadrícula de todas las páginas y miniaturas con impresora**: el catálogo de Asia-POP genera sus páginas desde los
  productos; reordenarlas a mano no es el flujo.

### Todavía sin verificar

Colores, tipografía y espaciado en píxeles del editor de Canva (REA pasivo no entrega estilos computados), el panel
«Estilo» de la fuente, Animar y Lista.
