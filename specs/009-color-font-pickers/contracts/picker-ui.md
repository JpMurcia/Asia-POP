# Contratos: componentes de los selectores

Feature interna (sin endpoints ni cambios en el formato de la plantilla). Los contratos son la interfaz de los componentes y los selectores accesibles que usarán las pruebas.

## 1. Módulos puros

```ts
// template-colors.ts
normalizeHex(text: string): string | null                       // '#e91' → '#EE9911'
foldText(text: string): string                                  // 'Ámbar' → 'ambar'
usedColors(template: Template): string[]                        // libres, normalizados, sin repetir, orden de primer uso
colorOptions(template: Template, opts: { none?: 'none' | 'transparent' }): ColorOption[]
searchColors(options: ColorOption[], query: string): ColorOption[]
BASIC_COLORS: readonly { name: string; hex: string }[]

// template-fonts.ts
usedFonts(template: Template): FontKey[]                        // familias que usan textos e insignias, sin repetir
fontChoices(template: Template): FontOption[]      // (distinto de `fontOptions` de inspector-fields, que se retira)
searchFonts(options: FontOption[], query: string): FontOption[]
```

## 2. `Popover`

```ts
<Popover open anchor={HTMLElement|null} title="Color: Relleno" onClose={() => void}>…</Popover>
```

- Portal en `document.body`, `role="dialog"`, `aria-label={title}`, `position: fixed` junto al ancla.
- Cierra con **Escape** y con clic fuera; al cerrar devuelve el foco al ancla.
- Encabezado con título y botón «Cerrar» (`aria-label="Cerrar"`).

## 3. `ColorPicker` (reemplaza los cuadritos de `ColorField`)

| Elemento | Contrato |
|----------|----------|
| Contenedor | `role="group"` con `aria-label` = etiqueta del campo (como hoy: «Relleno», «Contorno»…) |
| Botón-muestra | `aria-haspopup="dialog"`, `aria-expanded`, nombre «\<campo\>: \<color activo\>» (por ejemplo «Relleno: Acento 1»); deshabilitado con `locked` y título «Desbloquea el elemento para cambiar este ajuste» |
| Panel | `role="dialog"`, `aria-label` «Color: \<campo\>» |
| Buscador | `input type="search"`, `aria-label` «Buscar color por nombre o código» |
| Código válido | muestra la muestra y un botón «Aplicar \<código\>»; Enter aplica |
| Código inválido | `role="status"` con «El código de color no es válido»; no cambia nada |
| Grupo «Colores de la plantilla» | botones con `aria-pressed` (activo = `true`) y `aria-label` = nombre o código; «Ver todos (N)» si hay más de 18 libres |
| Grupo «Colores básicos» | idem, con los diez colores |
| Especiales | botón «Ninguno» o «Transparente» con `aria-pressed`, solo si el campo lo tiene |
| Selector gráfico | `input type="color"`, `aria-label` «Color personalizado» (se conserva) |
| Cuentagotas | botón «Cuentagotas», solo si `window.EyeDropper` existe |
| Estado | región `role="status"` que anuncia «Color activo: \<nombre\>» |
| Sin resultados | «No hay colores con ese nombre» y botón «Limpiar búsqueda» |

Resultado de elegir: `onChange({ [key]: valor })`; el selector gráfico además pasa `mergeKey = key`.

## 4. `FontPicker` (reemplaza el `select` de fuente)

| Elemento | Contrato |
|----------|----------|
| Botón | `aria-haspopup="dialog"`, `aria-expanded`, nombre «Fuente: \<fuente activa\>», con el texto escrito en su tipografía; deshabilitado con `locked` |
| Panel | `role="dialog"`, `aria-label` «Fuente» |
| Buscador | `input type="search"`, `aria-label` «Buscar fuente» |
| Grupo «Fuentes de la plantilla» | «Título · \<fuente\>», «Cuerpo · \<fuente\>» y las familias usadas |
| Grupo «Todas las fuentes» | las seis familias |
| Cada opción | botón con `aria-pressed`, el nombre escrito con su pila tipográfica (`style.fontFamily`) y una marca de verificación (`data-check`) en la activa |
| Sin resultados | «No hay fuentes con ese nombre» y «Limpiar búsqueda» |

Resultado de elegir: `onChange({ font: 'title' | 'body' | familia })`.

## 5. Teclado

| Tecla | Efecto |
|-------|--------|
| Enter / Espacio en el botón | abre el panel y lleva el foco al buscador |
| Tab / Mayús+Tab | recorre buscador, opciones y cierre |
| Enter en el buscador | aplica el código válido o el primer resultado |
| Escape | cierra el panel (y cancela el cuentagotas) y devuelve el foco al botón |

## 6. Compatibilidad

El formato de `ColorRef` y `FontRef` guardado no cambia; el render no cambia; un parche idéntico al valor actual no agrega paso de deshacer.
