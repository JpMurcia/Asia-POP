# Contrato: interfaz del editor y documento de plantilla (feature 007)

La feature no agrega rutas. Cambian dos contratos existentes: el **documento de plantilla** que viaja en `GET|PUT /api/settings/templates` ([contrato de 003](../../003-catalog-template-editor/contracts/rest-api.md)) y la **interfaz del inspector**, con su acción nueva en el reductor.

## 1. Documento de plantilla (`PUT /api/settings/templates`)

Un elemento `type: "text"` acepta dos claves opcionales más. Las demás claves y rutas no cambian.

```jsonc
{
  "id": "neon-p-3",
  "type": "text",
  "text": "$25.000",
  // … campos de 003 sin cambios …
  "ls": 0,
  "lh": 1.4,       // NUEVO, opcional: 0.8–2.5. Si falta, se dibuja con 1.05
  "strike": true   // NUEVO, opcional: booleano. Si falta, sin tachado
}
```

| Caso | Respuesta |
| --- | --- |
| `lh` y `strike` válidos | `200`; `GET` los devuelve iguales |
| Sin `lh` ni `strike` (plantilla anterior) | `200`; `GET` **no** los agrega |
| `lh: 3` | `400 validation_error`, `details[].field` = `templates[i].pages.<página>.els[j].lh`, mensaje "La altura de línea: el máximo es 2.5." |
| `lh: "1.2"` | `400`, "La altura de línea debe ser un número." |
| `strike: "sí"` | `400`, `…els[j].strike`, "Debe ser verdadero o falso." |

En los tres casos de error no cambian ni las plantillas, ni el negocio, ni la revisión (mismo comportamiento que 003).

## 2. Inspector, con un elemento seleccionado

### Acciones de alineación (todos los tipos de elemento)

Una fila de seis botones bajo las acciones del elemento (Duplicar, Al frente…), con este orden y `aria-label`:

| Orden | `aria-label` | `edge` |
| --- | --- | --- |
| 1 | Alinear a la izquierda | `left` |
| 2 | Centrar horizontalmente | `hcenter` |
| 3 | Alinear a la derecha | `right` |
| 4 | Alinear arriba | `top` |
| 5 | Centrar verticalmente | `vcenter` |
| 6 | Alinear abajo | `bottom` |

- El grupo tiene `role="group"` y `aria-label="Alinear a la página"`.
- Con el elemento bloqueado, los seis botones tienen `disabled` y `title="Desbloquea el elemento para alinearlo"`.
- Sin selección no se muestran (el inspector muestra el fondo de la página, como en 003).

### Campos nuevos de un texto (sección Tipografía)

| Campo | Control | Etiqueta | Posición | Valor mostrado |
| --- | --- | --- | --- | --- |
| `lh` | `range` 0.8–2.5, paso 0.05, sin unidad | "Altura de línea" | tras "Espaciado" | `lh` o 1.05 si falta |
| `strike` | `toggle` (`role="switch"`) | "Tachado" | tras "Mayúsculas" | apagado si falta |

## 3. Acción del reductor

```ts
type AlignEdge = 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom';

// EditorAction
{ type: 'align'; id: string; edge: AlignEdge; now: number }

// EditorActions (hook)
align: (id: string, edge: AlignEdge) => void
```

**Postcondiciones**

1. Elemento inexistente o bloqueado → el estado devuelto es **el mismo objeto** (sin paso en el historial).
2. Solo cambia `x` (horizontales) o `y` (verticales), según la [tabla del modelo de datos](../data-model.md#posición-del-elemento-todos-los-tipos-sin-campos-nuevos), acotado por `clampBox`.
3. Si el valor resultante es igual al actual → mismo objeto de estado (FR-004).
4. En otro caso → +1 paso en `past`, `future` vacío y `mergeKey: null` (dos alineaciones seguidas son dos pasos).

## 4. Render (`TemplateElement`, compartido por lienzo, miniaturas, vista previa y PDF)

| Propiedad | Estilo del texto |
| --- | --- |
| `lh` | `line-height: <lh ?? 1.05>` (sin unidad) |
| `strike: true` | `text-decoration-line: line-through` (color = color del texto) |
| `strike` falso o ausente | sin `text-decoration` |
