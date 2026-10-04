# Quickstart: validación de la feature 003

Escenarios para comprobar la feature de punta a punta. Detalle de endpoints en [contracts/rest-api.md](./contracts/rest-api.md) y de datos en [data-model.md](./data-model.md).

## Prerrequisitos

- Features 001 y 002 funcionando: `.env` con `SEED_USERNAME`, `SEED_PASSWORD`, `ENCRYPTION_KEY`; dependencias con `npm install`.
- Tipografías nuevas instaladas en el frontend: `@fontsource/bungee`, `@fontsource/zen-maru-gothic`, `@fontsource/space-grotesk` y `@fontsource/dm-serif-display`.
- Para escenarios sin cuenta real: servidor simulado de Alegra (`backend/tests/fixtures/dev-mock.ts`) con productos de varias categorías, al menos uno agotado y una sección propia con texto de introducción.
- Constitución en v1.1.0 (principio IV enmendado); ver `plan.md`.
- Línea base de 002 capturada **antes** de cambiar el render (tarea T004): PDF, una captura por página y copia de `frontend/src/print/` en `specs/003-catalog-template-editor/visual/baseline-002/`. El proyecto no es un repositorio git; sin esa copia no hay con qué comparar Neón Noche una vez eliminados los componentes antiguos.

## Arranque

```bash
npm run build
npm start        # http://127.0.0.1:<PORT>
```

Pruebas automáticas:

```bash
npm test         # backend y frontend
npm run test:pdf # PDF de muestra
```

## Escenarios

1. **Siembra y migración (US2, FR-021)**. Con una base de datos de 002 que tenga un tema guardado (por ejemplo fondo `#102030`), abre Apariencia: existen 4 plantillas (Neón Noche, Pop crema, Kawaii pastel, Kraft minimal), Neón Noche es la predeterminada y su paleta trae los colores del tema guardado. Con una base nueva, trae `#11052C / #FF007A / #00FF66 / #FF9900`.
2. **Entrar y salir del editor (US1)**. Apariencia abre el editor a pantalla completa sin la barra lateral; "← Menú" vuelve a Inicio. Comprueba barra superior, las cuatro secciones laterales, la tira de cuatro páginas, el zoom (20–200 % y Ajustar) y el inspector.
3. **Editar en el lienzo (US1)**. En Portada agrega un título, arrástralo, redimensiónalo desde la esquina y acércalo al centro (se ajusta y aparece la guía). Prueba flechas (0,5 %; 2 % con Mayús), Ctrl+D, Supr, Esc. Escribe en un campo: los atajos no actúan.
4. **Deshacer y rehacer (US1, SC-005)**. Haz 5 cambios distintos, deshaz hasta el primero y rehaz hasta el último. Un arrastre cuenta como un paso.
5. **Bloques automáticos (US1)**. En Productos intenta eliminar, ocultar y duplicar el bloque de productos y el pie: se impide con un mensaje. Desbloquéalo, muévelo y cambia Alternado → Tarjetas → Lista y Sello → Cinta → Gris. En Portada de sección verifica el bloque de introducción.
6. **Capas, fondo y vista previa (US1)**. Sin selección: edita el fondo (color, degradado, imagen) y usa la lista de capas (oculta, fija, selecciona un elemento oculto). Activa Vista previa: cuatro páginas sin marcos; vuelve a Editar.
7. **Paleta y tipografía (US3)**. En Estilo cambia Acento 1: todos los elementos que lo usan cambian. Aplica una paleta sugerida y deshaz. "Restaurar colores originales" vuelve a la paleta de fábrica. Escribe `rosa`: se rechaza. Usa un fondo claro: aparece la advertencia pero se puede guardar. Elige otro par tipográfico y verifica que cambian títulos y cuerpo.
8. **Galería de plantillas (US4)**. Crea "Nueva · Kawaii pastel", duplícala, márcala "Usar al generar", elimina otra (con confirmación). La predeterminada no ofrece Eliminar. Renombra una plantilla desde la barra superior; un nombre vacío no se guarda. **Cronometra el recorrido de SC-004**: sin ayuda, crear una plantilla desde un estilo base, cambiar un color, mover un elemento, marcarla predeterminada y generar el PDF debe tomar menos de 10 minutos.
9. **Datos y marcadores (US5)**. En Datos cambia el segundo teléfono y verifica el lienzo y la vista previa. Déjalo vacío: `{telefonos}` muestra solo uno. Banner de 81 caracteres o políticas de más de 3500: el contador alerta y no deja guardar. Inserta un marcador con los botones del inspector.
10. **Guardar, aviso y pestañas (US1)**. El indicador cambia entre "Cambios sin guardar" y "Todo guardado". Con cambios pendientes, "← Menú" o cerrar la pestaña avisan. Con dos pestañas abiertas, guarda en una y luego en la otra: la segunda recibe "cambió, recarga" y no pisa nada. Recarga y confirma que todo persiste (SC-007).
11. **PDF fiel al editor (US2, SC-002, SC-003)**. Genera con Neón Noche sin tocarla y compara con el PDF de 002 y `docs/Cat.pdf` (lista de diferencias en `research.md` §6). Mueve un elemento en el editor, guarda, genera y comprueba que está en el mismo sitio. Repite con cada estilo base: páginas, número de portadas y de páginas = vista previa de estructura (SC-010).
12. **Plantilla por generación (US2)**. En Generar elige otra plantilla: ese PDF la usa y la predeterminada no cambia; al reabrir Generar vuelve a aparecer la predeterminada. Prepara, elimina esa plantilla desde otra pestaña y genera: se usa la predeterminada y se avisa. Guarda una plantilla entre preparar y generar: el PDF usa la guardada.
13. **Agotado, textos largos y datos (US2, SC-006, SC-009)**. Con cada estilo de agotado, los productos agotados muestran AGOTADO y los productos propios no. Textos en el máximo (nombres, descripciones, políticas, banner, dirección, introducción): nada desborda con las cuatro plantillas base. `{banner}`, `{seccion}`, `{telefonos}`, `{direccion}` y `{tienda}` salen con el dato real en cada página.
14. **Ajustes menores (US6)**. "Quitar todas / Seleccionar todas" en Generar actualiza la vista previa de estructura. En Combos, el desglose (suma, ahorro, precio) cambia al editar. Inicio muestra "hace N min" junto a los productos activos. Conexión Alegra muestra los intentos restantes y, tras agotarlos, pide esperar.
15. **Seguridad y rendimiento**. Sin sesión, `GET /api/settings/templates`, `PUT /api/settings/templates` y `GET /api/settings/templates/summary` devuelven `401`; `GET /api/settings/theme` devuelve `404`. El token de Alegra no aparece en ninguna respuesta. Mide a 1366×768: con 60 elementos en la página, el elemento arrastrado acompaña al puntero con un retraso < 100 ms (grabación de pantalla o `performance.now()` entre `pointermove` y el siguiente cuadro pintado), propiedad → lienzo < 0,2 s, guardar < 1 s, cambio de color a PDF < 3 min (SC-001, SC-008).

## Criterios de salida

- Todos los escenarios pasan y `npm test` queda en verde, incluida la prueba de fidelidad editor ↔ PDF.
- El responsable de la tienda aprueba la revisión visual de Neón Noche contra `docs/Cat.pdf` y el PDF de 002 (SC-003) y la de las otras tres plantillas base contra el mockup.
- Pendientes de 001 (cuenta real de Alegra, revisión final) siguen abiertos; esta feature no depende de ellos.
