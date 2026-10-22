# Contratos: esquema de la plantilla y panel del inspector

Feature interna (sin endpoints nuevos). Los contratos son el **formato guardado** de la plantilla y la **interfaz del inspector**.

## 1. Formato guardado (`PUT /api/templates/:id`, sin cambios de ruta)

El cuerpo es el documento de plantilla ya existente. Un elemento de texto admite ahora:

```jsonc
{
  "type": "text",
  "ls": 12.5,          // −10 … 60, píxeles; obligatorio como hoy
  "lh": 1.37,          // 0,5 … 2,5; opcional
  "vAlign": "bottom"   // "top" | "middle" | "bottom"; opcional (falta ⇒ "middle")
}
```

Errores de validación (HTTP 422, el mismo formato `{ error, details }` que ya devuelve el esquema):

| Entrada | Respuesta |
|---------|-----------|
| `lh: 0.4` o `lh: 9` | Mensaje de rango de «La altura de línea» |
| `ls: -11` o `ls: 61` | Mensaje de rango de «El espaciado» |
| `vAlign: "centro"` | Mensaje de «La alineación vertical» |
| plantilla anterior sin `vAlign` | Se acepta tal cual |

Lectura: una plantilla sin `vAlign` se devuelve **sin** el campo (no se rellena), para no cambiar lo guardado.

## 2. Descriptores del inspector (`inspector-fields.ts`)

```ts
// nuevo
{ kind: 'section'; id: string; label: string; fields: FieldDesc[] }
// ampliado
{ kind: 'range'; …; numeric?: boolean; decimals?: number }
```

Texto, en este orden:

1. `Tipografía`: Fuente, Tamaño, Peso, Alineación, Mayúsculas, Tachado (**sin** Espaciado ni Altura de línea).
2. `section` **«Configuración avanzada»** (cerrada por defecto):
   - `range` «Altura de línea» — min 0,5 · max 2,5 · paso 0,01 · `numeric` · 2 decimales · `fallback` 1,05
   - `range` «Espaciado» — min −10 · max 60 · paso 0,1 · `numeric` · 1 decimal · unidad « px»
   - `segmented` «Anclaje vertical» — Arriba · Centro · Abajo (`vAlign`, activo «Centro» si falta)
3. `Color y efectos` (sin cambios).

Solo `text` lleva la sección (FR-012).

## 3. Accesibilidad y pruebas (selectores estables)

| Elemento | Contrato |
|----------|----------|
| Cabecera del panel | `button` con nombre «Configuración avanzada» y `aria-expanded` |
| Deslizadores | `input[type=range]` con `aria-label` «Altura de línea» y «Espaciado» |
| Campos numéricos | `input` con `aria-label` «Altura de línea (valor)» y «Espaciado (valor)» |
| Anclaje | grupo «Anclaje vertical» con botones «Arriba», «Centro», «Abajo» y `aria-pressed` |
| Bloqueado | los controles quedan deshabilitados con la indicación que ya usa el editor |

## 4. Render

`TemplateElement` aplica `alignItems` a `.tpl-text-box` solo si `vAlign` existe y es distinto de `middle`; con `top` ⇒ `flex-start`, con `bottom` ⇒ `flex-end`. Sin el campo, el marcado es idéntico al actual.
