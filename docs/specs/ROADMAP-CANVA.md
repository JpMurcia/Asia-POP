# Hoja de ruta: acercar el editor a la experiencia de Canva

**Estado**: propuesta · **Creado**: 2026-10-22 · **Pedido del responsable**: «quiero todo y que parezca lo más semejante, para que el usuario esté familiarizado».

## Reglas (de `PENDIENTES-REA.md` §4, no negociables)

- Se imita la **organización, los patrones y las medidas** observadas con REA. **No** se copian assets, íconos, logotipos ni textos de Canva: Asia-POP conserva su marca (colores) y sus propios íconos.
- Cada feature se mide primero con REA (Vivaldi con `--remote-debugging-port=9222` abierto en el editor de Canva) y se cita la evidencia en su spec. Lo que REA no pueda medir se marca **no verificado**.
- Cada feature pasa por `/speckit-specify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-implement`, con la línea base de PDFs antes de tocar el render y comparación byte a byte al final.
- Todo lo que cambie el render se dibuja igual en lienzo y PDF (constitución IV).

## Fuera de alcance (no aporta a un catálogo en PDF)

Animar, Presentar, Dibujar, Apps, Texto mágico, colaboración y comentarios, video y audio, gráficas, kit de marca de pago.

## Features, en orden

| # | Feature | Qué trae (referencia: Canva) | Depende de |
| --- | --- | --- | --- |
| 012 | **Texto estilo Canva** | Cursiva, subrayado, justificado, listas (viñetas y numerada), panel «Efectos» como cuadrícula con vista previa (Ninguno, Sombra, Brillo, Eco, Contorno, Fondo, Desalineado, Sin relleno, Neón, Distorsión), «Curvar», copiar estilo | 011 |
| 013 | **Elementos y formas** | Más formas (estrella, estallido, flechas, globos), líneas con estilo y extremos, marcos, voltear, agrupar y desagrupar, bloqueo de proporción, enlaces clicables | 012 (barra contextual) |
| 014 | **Imágenes y «Subidos»** | Pestaña «Subidos» con carpetas, recortar con proporciones, borde y esquinas, ajustes de foto (brillo, contraste, saturación…), filtros, reemplazar arrastrando | 013 |
| 015 | **Interfaz y PDF de imprenta** | Barra contextual flotante sobre el elemento, cajón colapsable, menú Archivo y Configuración de vista, reglas y guías, lista de zoom, notas, acciones de página, PDF con sangrado y marcas de corte | 012 a 014 |

Cada feature es grande por sí sola; se hacen **una por una** porque tocan los mismos archivos (`inspector-fields.ts`, `TemplateElement.tsx`, `template.ts`) y dos escritores a la vez se pisarían.

## Estado

- [x] 012 (2026-10-22, revisión manual T031 hecha el 2026-10-23) · [ ] 013 · [ ] 014 · [ ] 015
- Evidencia de partida: `docs/specs/rea-evidence/` (22 capturas), `canva-fields-inventory.md` §6 revisada.
