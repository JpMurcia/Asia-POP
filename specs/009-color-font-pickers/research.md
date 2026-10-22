# Research: Selectores de color y de fuente

No quedó ninguna marca `NEEDS CLARIFICATION`. REA no hizo falta: la organización ya está medida en la spec (capturas 08 y 09). Decisiones tomadas al leer el código actual (`FieldRenderer.tsx`, `inspector-fields.ts`, `EstiloPanel.tsx`, `print/assets.ts`).

## R1. Un solo `Popover` posicionado de forma fija

- **Decisión**: panel con `position: fixed`, colocado con `getBoundingClientRect()` del botón que lo abre (a la izquierda del inspector, que está pegado al borde derecho; se acota al alto de la ventana), dibujado con un portal en `document.body`. Escape y clic fuera lo cierran; al cerrar devuelve el foco al botón.
- **Por qué**: `.ed-inspector` tiene `overflow: auto`; un panel dentro de él se recortaría o haría scroll. Un portal con posición fija evita ambos problemas y es independiente del scroll del inspector.
- **Alternativas**: panel en línea (acordeón) dentro del inspector — rechazada: la spec pide un panel anclado junto al control (FR-001, FR-010) y el inspector es estrecho; librería de popover — rechazada: sin dependencias nuevas (VI).

## R2. «Colores de la plantilla» se calcula, no se guarda

- **Decisión**: función pura `usedColors(template)` que recorre `pages[*].bg` y `pages[*].els[*]` y reúne todo valor de cadena que sea `#RRGGBB` (se ignoran las claves `text`, `name`, `id`, `src`, que pueden contener algo parecido a un código). Se normaliza a mayúsculas (3 dígitos se expanden), se quita lo que coincide con alguno de los seis colores de la paleta y se ordena por **orden de primer uso** (página y elemento), sin repetir.
- **Por qué**: es genérico: cualquier propiedad de color que se agregue en el futuro entra sola. Los textos libres quedan excluidos por nombre de clave. Un color libre igual a uno de la paleta se muestra como el de la paleta (así elegirlo guarda la clave y sigue a la paleta, FR-004).
- **Límite** (borde de la spec): el grupo muestra hasta **18** libres y un botón «Ver todos (N)» despliega el resto.
- **Alternativas**: recorrer solo los descriptores del inspector — rechazada: obliga a instanciar un descriptor por elemento y se desincroniza con el modelo.

## R3. Normalización y búsqueda de color

- **Decisión**: `normalizeHex(text)` acepta `#` opcional, 3 o 6 dígitos y cualquier mayúscula; devuelve `#RRGGBB` en mayúsculas o `null`. La búsqueda por nombre normaliza con `normalize('NFD')` sin diacríticos y minúsculas, y compara por «contiene» contra las etiquetas de la paleta («Acento 2») y diez colores básicos con nombre en español (rojo, naranja, amarillo, verde, azul, morado, rosado, negro, gris, blanco).
- **Por qué**: el selector gráfico del navegador devuelve `#rrggbb` en minúsculas y el editor ya guarda mayúsculas; normalizar en un solo punto evita duplicados «distintos». El código escrito y confirmado con Enter se aplica; uno inválido muestra un mensaje y no cambia nada (FR-006).
- **Alternativas**: aceptar nombres CSS de 140 colores — rechazada por la spec (conjunto corto y fijo).

## R4. Cuentagotas con `EyeDropper`

- **Decisión**: se muestra solo si `'EyeDropper' in window`. `new EyeDropper().open()` devuelve `{ sRGBHex }`; se normaliza y se aplica como color libre. Escape o cualquier rechazo (`AbortError`) se ignora y conserva el color anterior.
- **Por qué**: es la API estándar de Chrome/Edge (los navegadores del responsable); no existe en Firefox/Safari, donde el botón simplemente no aparece (FR-008).
- **Pruebas**: se simula `window.EyeDropper` con una clase doble, con y sin el objeto.

## R5. Conservar el selector gráfico dentro del panel

- **Decisión**: el `input type="color"` actual (nombre accesible «Color personalizado») pasa al panel. Su `onChange` sigue usando `mergeKey` para que arrastrar dentro del selector sea un solo paso de deshacer.
- **Por qué**: FR-007 y SC-005: ninguna capacidad actual se pierde. El nombre accesible se conserva para que las pruebas existentes lo sigan encontrando después de abrir el panel.

## R6. Selector de fuente

- **Decisión**: nuevo descriptor `{ kind: 'font', key, label }` que sustituye al `select` de fuente (los dos usos en `inspector-fields.ts`). `FontPicker` recibe la plantilla para mostrar «Título · Fredoka» y «Cuerpo · Poppins» con su tipografía, reúne las familias que usan los elementos (`font` de textos e insignias; los bloques automáticos no tienen) y dibuja cada nombre con `FONT_STACKS` (ya cargadas localmente por `fonts.css`; si una tarda, el navegador usa la de reemplazo y la corrige sola).
- **Por qué**: el estilo en línea con la pila tipográfica es lo que ya hace el render, así que el nombre se ve exactamente como saldrá. No hay carga adicional.
- **Alternativas**: precargar con `document.fonts.load` — innecesario: las seis fuentes son locales.

## R7. Historial: elegir lo activo no agrega paso

- **Decisión**: el `case 'patch'` del reductor (hoy con `settleText` solo para textos, de la 008) descarta ahora cualquier parche cuyos valores ya sean los del elemento, para todos los tipos; `patchBg` hace lo mismo con el fondo. La comparación es por valor efectivo (con los valores por defecto de `TEXT_DEFAULTS` solo en textos).
- **Por qué**: FR-009 y FR-015. Hoy elegir el color activo agrega un paso vacío. La guarda es una comparación de claves; los parches del arrastre (distinta posición) no se ven afectados.
- **Riesgo**: alguna prueba existente podría esperar un paso con un parche idéntico; se revisa al actualizar las pruebas.

## R8. Elementos bloqueados

- **Decisión**: con `locked`, los botones que abren los selectores quedan deshabilitados con el título «Desbloquea el elemento para cambiar este ajuste» (el mismo texto base que ya usan la alineación y la 008). El fondo de la página no se bloquea.
- **Por qué**: FR-019. **Cambio de comportamiento**: hoy los colores y la fuente de un elemento bloqueado sí se pueden editar. Se sigue la spec; si no se quiere, basta quitar `disabled` en `FieldRenderer`.

## R9. Teclado y accesibilidad

- **Decisión**: el botón lleva `aria-haspopup="dialog"`, `aria-expanded` y su nombre incluye el valor activo («Relleno: Acento 1»). El panel es `role="dialog"` con `aria-label` («Color: Relleno»); las opciones son botones con `aria-pressed`; hay una región `role="status"` que anuncia el color o la fuente activos y los errores del código. Tab recorre el panel; Escape cierra y devuelve el foco; Enter en el buscador aplica el primer resultado o el código válido.
- **Por qué**: FR-018 y SC-007; sin dependencias.
