# Pendientes: mapeo de Canva con REA y mejoras del editor

**Estado**: abierto · **Creado**: 2026-10-14 · **Rama**: `main` (todo el trabajo anterior ya está unificado ahí)

> **Decisión del responsable**: REA es **indispensable**. Las mejoras del editor deben basarse en mediciones reales
> de Canva hechas con REA, no en documentación pública ni en suposiciones. Todo lo hecho hasta ahora sin REA es
> **provisional** y se revisa contra esas mediciones.

---

## 1. Qué se hizo en la sesión anterior y qué tan firme es

| Entregable | Base | Estado |
| --- | --- | --- |
| `docs/specs/canva-ui-mapping.md` | Código de Asia-POP + patrón general de editores | ⚠️ **Provisional**: las celdas ⏳ de Canva están vacías |
| `docs/specs/canva-fields-inventory.md` | Ayuda pública de Canva y búsquedas web, **sin REA** | ⚠️ **Provisional**: nombres, ubicaciones y rangos sin medir |
| Feature 007 (`specs/007-editor-align-text-tools/`): alinear a la página, altura de línea, tachado | Inventario provisional | ✅ Implementada y probada (27/27 tareas). ⚠️ Sus rangos y su interfaz se eligieron **sin** medir Canva: hay que revisarlos (§3, paso 4) |

Por qué REA no se usó: la sesión corría en un **contenedor en la nube**. Su `127.0.0.1:9222` no es el del computador
del responsable, y el proxy de red bloquea `canva.com` y `open.spotify.com`. REA se instaló y sus herramientas
aparecieron en la sesión, pero **ninguna llegó a ejecutarse contra un objetivo**.

---

## 2. Requisito para la nueva sesión (bloqueante)

La sesión **tiene que correr en local**, en el mismo computador donde está el navegador. Una sesión en la nube no
puede alcanzar el puerto 9222 de ese computador.

1. Claude Code **local** (CLI o app de escritorio), con este repositorio clonado y actualizado en `main`
   (`git checkout main && git pull`).
2. Registrar REA en ese Claude Code y reiniciarlo:
   ```bash
   npx rea-agents setup            # elegir Claude Code y aprobar los cambios
   ```
3. Abrir Vivaldi (o Chrome) con depuración remota, cerrando antes las demás ventanas:
   ```bash
   # Windows
   "C:\Users\<usuario>\AppData\Local\Vivaldi\Application\vivaldi.exe" --remote-debugging-port=9222 --user-data-dir=C:\tmp\vivaldi-rea
   # macOS / Linux
   vivaldi --remote-debugging-port=9222 --user-data-dir="$HOME/.vivaldi-rea"
   ```
4. Comprobar que responde: `curl http://127.0.0.1:9222/json/version`
5. Iniciar sesión en Canva en esa ventana y abrir un diseño en el editor.
6. Verificar en Claude Code que existen las herramientas `mcp__rea__*` (por ejemplo `list_browser_targets`).

**Si cualquiera de estos pasos falla, la sesión se detiene y lo reporta. No se rellena nada con suposiciones.**

---

## 3. Pendientes, en orden

### Paso 1 — Mapeo con REA (base de todo lo demás)

Con `list_browser_targets`, `capture_web_screenshot` e `inspect_web_page` (**siempre con `include_script_sources: false`**)
sobre la pestaña del editor de Canva:

- [~] **P1.1** (no verificable con REA pasivo: colores y espaciados quedan estimados desde capturas) Llenar **todas** las celdas ⏳ de `docs/specs/canva-ui-mapping.md` §1 (color, tipografía, espaciado,
      radios, sombras, z-index), con un **selector o captura como evidencia** por valor.
- [x] **P1.2** Confirmar o corregir la anatomía de `canva-ui-mapping.md` §2: barra superior, riel y cajón, barra
      contextual, lienzo y pie. Medir el ancho del cajón y su animación.
- [x] **P1.3** Capturar los estados de `canva-ui-mapping.md` §4 con `observe_web_session` / `compare_web_captures`:
      (a) nada seleccionado, (b) texto seleccionado, (c) forma seleccionada, (d) imagen seleccionada,
      (e) menú desplegable abierto, (f) cajón cerrado.
- [~] **P1.4** (parcial: barras contextuales, Configuración avanzada, Posición y rangos medidos; falta el resto de tablas) Recorrer `docs/specs/canva-fields-inventory.md` tabla por tabla: confirmar cada campo, su control y
      sus valores. Reemplazar cada ⏳ por el valor medido y marcar como **verificado con REA** lo comprobado.
      Lo que no se pueda observar queda marcado como **no verificado**, nunca inventado.
- [x] **P1.5** Guardar las capturas de evidencia en `docs/specs/rea-evidence/` (las PNG no se versionan por
      `.gitignore`; dejar un `README.md` con la lista y cómo regenerarlas).

### Pendientes de la feature 010 (plantilla Base AsianPop)

La feature está implementada (`specs/010-base-template-product-card/`). Lo que sigue requiere REA con Vivaldi abierto en el puerto 9222:

- [ ] **T038** Medir con **Capas → Organizar** las tarjetas 1 y 2 de la página 3 de «PRUEBA CATALOGO». Verificado de forma aproximada con la captura 19: fila 2 con la foto en X 50,5 %, la burbuja en 12,6 % y el precio centrado en 33,6 %, todo a ~0,5 % de lo estimado (≈1,5 mm). Si la medida exacta difiere más de 2 mm, ajustar las constantes `BASE_*` de `backend/src/catalog/template-layout.ts` y su prueba.
- [ ] **Sin medir**: portadas (posición, tipografía y tamaño del título, de «Domicilios» y de los íconos), páginas 28 a 42, sombra y burbuja (desenfoque, transparencia), estrellas y manchas, y la **unidad del tamaño de letra** (32, 21, 14 y 58 se tomaron 1:1 en px lógicos; falta una prueba de impresión).
- [ ] **Calibrar** los umbrales de «Quitar el fondo automáticamente» con fotos reales de Alegra (hoy solo con fotos sintéticas) y el neón contra la base.

### Paso 2 — Repriorizar con datos reales

- [ ] **P2.1** Rehacer la sección 6 ("Qué vale la pena traer a Asia-POP") del inventario con lo medido. Mantener
      fuera lo que no aporta a un catálogo en PDF (Animar, Dibujar, Apps, Presentar…).
- [ ] **P2.2** Actualizar `canva-ui-mapping.md` §1.2 (archivo de tokens) con la decisión de qué se toma de la
      referencia. Recomendación previa: conservar la **marca** de Asia-POP (colores) y adoptar la **estructura**
      (densidad, escala de espaciado, elevación).

### Paso 3 — Revisar la feature 007 contra lo medido

- [x] **P3.1** Comparar con Canva y anotar las diferencias en
      `specs/007-editor-align-text-tools/research.md` (sección nueva "Revisión con REA"):
  - rango y paso de **altura de línea** (hoy 0,8–2,5, paso 0,05, por defecto 1,05),
  - **dónde** están y **cómo se ven** las acciones de alinear (hoy seis botones en el inspector),
  - cómo se presenta el **tachado** (hoy un interruptor tras Mayúsculas).
- [x] **P3.2** (cerrado por la feature 008, `specs/008-text-advanced-settings/`: altura de línea 0,5–2,5 con paso 0,01, espaciado −10…60 px, anclaje vertical y panel «Configuración avanzada»; **sin medir**: la unidad exacta del interletrado de Canva, que se dejó en píxeles por decisión del responsable) Si hay diferencias que valga la pena cerrar: `/speckit-clarify` sobre la 007 (o una feature nueva
      008 si el cambio es grande) → `/speckit-plan` → `/speckit-tasks` → `/speckit-implement`.
      **Regla**: `TEXT_DEFAULTS.lh` sigue en 1,05 aunque Canva use otro valor, porque cambiarlo alteraría las
      plantillas ya guardadas (FR-015). Un valor por defecto distinto solo aplicaría a textos nuevos, y requiere
      decisión explícita del responsable.

### Paso 4 — Nuevas mejoras con el ciclo Spec Kit

- [ ] **P4.1** Con la lista repriorizada (P2.1), especificar la siguiente feature con `/speckit-specify`,
      citando la evidencia de REA en la spec. Candidatos de la sesión anterior, **a confirmar con REA**:
      sombra y fondo como efectos de texto, imágenes subidas (logo y fotos propias), PDF para imprenta con
      sangrado y marcas de corte, enlaces clicables, cajón colapsable, barra contextual flotante, íconos Lucide.
- [ ] **P4.2** Implementar con pruebas primero, como en la 007: línea base de PDFs antes de tocar el render,
      comparación byte a byte después, y fidelidad en Chrome real.

### Pendientes manuales de la feature 007 (independientes de REA)

- [ ] **M1** Quickstart escenario 6 con el `data/app.db` **real**: abrir una plantilla guardada antes de la 007,
      comprobar que el indicador dice "Todo guardado" y que se ve igual.
- [ ] **M2** SC-006: cronometrar a una persona componiendo "~~$25.000~~ $19.900": menos de 1 minuto.
- [ ] **M3** Probar en Windows con el navegador habitual (la sesión anterior validó en Linux con Chromium).
- [x] **M4** Unificar en `main`: hecho el 2026-10-22 (la rama `claude/stoic-mayer-vluycb` se integró sin conflictos).

---

## 4. Límites de uso (no negociables)

- Observar la interfaz **renderizada** (DOM, estilos, capturas), lo mismo que DevTools.
- **No** usar `recover_javascript_sources`, `analyze_web_bundle`, `export_web_scripts` ni ninguna herramienta que
  extraiga o reconstruya el código de Canva: sus términos prohíben la ingeniería inversa del servicio.
- **No** copiar assets, íconos, logotipos ni textos de Canva. A Asia-POP llegan patrones y medidas, con su propia marca.

---

## 5. Prompt para iniciar la nueva sesión

Copiar y pegar en Claude Code **local**, ya con REA instalado y Vivaldi abierto en el editor de Canva:

```text
Lee docs/specs/PENDIENTES-REA.md y ejecútalo en orden.
1. Verifica los requisitos de la sección 2; si alguno falla, detente y dime cuál.
2. Haz el Paso 1 (mapeo con REA) completo, con evidencia por cada valor y respetando los límites de la sección 4.
3. Haz el Paso 2 y el Paso 3.1, y muéstrame las diferencias entre Canva y la feature 007 antes de cambiar código.
4. Cuando las apruebe, sigue con el Paso 3.2 y el Paso 4 usando el ciclo Spec Kit
   (/speckit-specify → /speckit-plan → /speckit-tasks → /speckit-implement).
Marca cada casilla de este archivo al terminarla y sube los cambios a la rama al final de cada paso.
```
