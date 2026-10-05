# Validación: Omitir artículos de Alegra del catálogo

**Feature**: `006-omit-alegra-articles` | **Fecha**: 2026-10-05 | **Estado**: completa, con una excepción de rendimiento (SC-009) y pendiente la aprobación visual de la persona responsable (SC-010)

## Cómo se hizo

- **Escenarios 2 a 7 y 9** de [quickstart.md](./quickstart.md), con el simulador de Alegra (`backend/tests/fixtures/dev-mock.ts`) y la app compilada, en el navegador del panel. Instancia **aislada**: la app en el puerto 3100 con una carpeta `data` temporal y el simulador en el 3920; la carpeta `data/` real y la conexión real con Alegra no se usaron.
- **Escenario 8**, con la **cuenta real** (solo lectura) y la base de datos real, en otra sesión posterior y con confirmación del responsable. Ver la sección propia más abajo.
- Los PDF se leyeron con `pdf-parse` desde la carpeta de salida de esa instancia.
- Los datos son los del simulador (RAMEN, SNACKS, MOCHIS, «Combo regalo» con «Champong» agotado); no hay nombres ni datos reales de la tienda.

Línea base del simulador: 9 productos activos, 1 agotado, 1 sin categoría, 9 páginas estimadas.

## Resultados

| # | Escenario | Resultado | Evidencia |
| --- | --- | --- | --- |
| 2 | Pantalla nueva | ✅ | Lista de 9 artículos con nombre, sección o «Sin categoría», precio y «Agotado»; resumen «9 artículos · 0 omitidos». «SHIN» y «RAMYÚN» encuentran «Shin Ramyun» (mayúsculas y tildes); el filtro SNACKS muestra 4 y «Sin categoría» 1 (Palillos), con los conteos «Todos (n)» / «Omitidos (0)» siguiendo el filtro |
| 3 | Omitir y persistencia | ✅ | «Kimchi Bowl» y «Soon Veggie» (RAMEN) omitidos al instante, sin botón de guardar; siguen omitidos tras **recargar**, **cerrar y abrir sesión** y **reiniciar el servidor** |
| 4 | Generar sin ellos | ✅ | La revisión muestra «2 artículos omitidos por ti» (con los nombres y el enlace «Administrar artículos»), debajo de los conteos y aparte de los 3 omitidos por problemas. La vista previa no los trae. El PDF (4,3 MB, Optimizada) tiene **8 páginas** (la estimación bajó de 9 a 8), no contiene «Kimchi» ni «Soon Veggie», conserva al resto y tiene AGOTADO en 2 páginas (Champong y el combo) |
| 5 | Coherencia | ✅ | Omitidos «Palillos», «Sin foto» y «Champong». Sin categoría: «Palillos» sale como «Omitido», «No quedan pendientes de asignar» y el menú ya no muestra contador. Inicio: «Productos activos en Alegra» sigue en **9** con la nota «5 omitidos del catálogo», «Agotados» 0, «Sin categoría» 0, páginas estimadas 8. Revisión: «5 artículos omitidos por ti» y ningún aviso de sin categoría ni sin imagen por ellos. Pantalla de artículos: «Está en el combo «Combo regalo». El combo no cambia.». El combo mantiene componentes y precio ($35.100) y sigue pidiendo decisión por «Champong» (agotado en Alegra). En el PDF «Champong» aparece solo en la página del combo |
| 6 | Sección que se vacía | ✅ | Omitidos los artículos de SNACKS: la sección desaparece de «Secciones a incluir», de Inicio y del PDF (**6 páginas**, sin portada ni página de SNACKS; las 6 estimadas por Inicio coinciden). Con todo omitido y sin contenido propio, la revisión dice «No hay productos para generar el catálogo.», «Generar PDF» queda deshabilitado y no aparece «Secciones a incluir» |
| 7 | Cambio desde otra pestaña | ✅ | Preparado en la pestaña A; «Pepero» omitido en la pestaña B; «Generar PDF» en A muestra «Cambiaste los artículos omitidos después de preparar. Vuelve a preparar el catálogo para aplicar el cambio.», el trabajo sigue en reposo y el Historial no crece. Tras **Preparar y revisar** de nuevo, el PDF (7 páginas) coincide con la revisión (sin «Pepero»). Al volver a incluirlo, la preparación vieja da otra vez el conflicto y, tras preparar, «Pepero» reaparece en el PDF |
| 8 | Cuenta real | ✅ con una excepción | Ver «Escenario 8» más abajo: los omitidos no están en el PDF real, el resto sí y reaparecen al volver a incluirlos; **SC-009 (lista en < 10 s) no se cumple** (12,6 – 18,9 s) |
| 9 | Alegra caído | ✅ | Con el simulador detenido, la pantalla muestra «No se pudo conectar con Alegra.», el enlace «Revisa la conexión con Alegra» (a `/alegra`) y el botón «Reintentar», sin lista |

## Limitaciones de esta validación

- El panel del navegador no llegó a dibujar la página (las capturas agotaron el tiempo de espera), así que **la apariencia de las pantallas del panel no se revisó**; todo se comprobó leyendo el contenido y los atributos de la página y el texto de los PDF. Algunos clics se hicieron por script sobre los mismos botones. Las páginas de los PDF sí se vieron como imagen (escenario 8).
- Que la lista guardada de omitidos siga intacta cuando Alegra no responde (FR-015) se comprueba en la prueba de integración `omitted-articles.test.ts`; aquí la lista estaba vacía al detener el simulador.
- Para el caso «todo omitido» se eliminó la sección propia MOCHIS de la instancia de prueba (solo en esos datos temporales).

## Observaciones

- Ninguna desviación funcional respecto al contrato.
- Quedaron sin cambios «Último catálogo» y su cuenta de «omitidos» en Inicio (significan sin foto o sin sección, como antes).

## Escenario 8: cuenta real (solo lectura)

Datos agregados de la tienda, sin nombres de productos ni identificadores. Antes de empezar se hizo una copia de seguridad de la base de datos real y, al terminar, se comprobó que solo cambiaron lo esperado: se aplicó la migración 004, la lista de omitidos quedó en 0 y el Historial ganó un catálogo (el de prueba). Conexión con Alegra, secciones, producto propio y plantillas quedaron intactos; la copia se eliminó.

Cuenta: 195 productos activos (41 agotados), una categoría de Alegra y una sección propia; plantilla predeterminada **Neón Noche**; 66 páginas estimadas.

| Comprobación | Resultado |
| --- | --- |
| Tiempo en que aparece la lista de Artículos de Alegra (SC-009, meta < 10 s) | ❌ **18,9 s, 12,6 s y 14,9 s** (3 mediciones). Para comparar: Inicio 10,4 y 11,6 s y la pantalla **Sin categoría**, que ya existía, 11,1 s |
| Omitir 3 artículos incluidos en el catálogo (1 agotado y 2 normales) | ✅ Los tres quedan fuera del catálogo preparado; la revisión informa los 3 por separado de los 14 omitidos por problemas |
| Preparar y generar con Neón Noche, calidad Optimizada (SC-004 de 005, < 2 min) | ✅ Preparar 26,6 s + generar 8,1 s ≈ 35 s |
| Páginas del PDF | ✅ 65, igual a las que anunció la preparación |
| Los 3 omitidos en el texto del PDF | ✅ 0 de 3 (el agotado tampoco sale como tarjeta con AGOTADO) |
| El resto del catálogo | ✅ Están en el PDF los 176 artículos de Alegra esperados (179 de la línea base menos los 3) |
| Volver a incluirlos | ✅ Los 3 reaparecen en el catálogo preparado, la revisión ya no muestra omitidos y el catálogo vuelve a 182 productos incluidos (179 + 3) y 66 páginas, como el del 4 de octubre |
| Revisión visual de páginas | Una página de productos del catálogo nuevo (25 MB, con omitidos) es **idéntica** a la misma página del catálogo del 4 de octubre (156 MB, sin optimizar): mismas fotos, diseño y nitidez |
| Aprobación de la persona responsable (SC-010) | ⏳ pendiente: el catálogo de prueba quedó en el Historial de la aplicación para que lo revise |

### Hallazgos

1. **SC-009 no se cumple con la cuenta real.** El tiempo lo domina el paginado de Alegra (7 páginas de 30 artículos, pedidas una tras otra, de ~1,6 s cada una), el mismo costo que ya tienen Inicio y Sin categoría. La pantalla además pide las categorías, lo que explica parte de la diferencia con Sin categoría. Opciones: aceptar el tiempo (la meta de 10 s se fijó sin haberlo medido), o pedir las páginas en paralelo o guardar la lista unos segundos, lo que afecta a todas las pantallas que leen Alegra y sería otra feature.
2. **El PDF optimizado real pesa 26.214.576 bytes (25,0 MB), 176 bytes por encima del límite de 25 MB** de la feature 005 (que estimaba ~20 MB). Con ese peso la pantalla Generar muestra «25,0 MB» y a la vez avisa que supera los 25 MB. No lo causa esta feature; la validación con la cuenta real de 005 (T045) quedó sin hacer y esta es su primera medición.
3. **La línea base y la corrida con omitidos no son del todo comparables**: la primera preparación no obtuvo la foto de 2 productos que la segunda sí obtuvo (16 contra 14 omitidos por problema). Es la variabilidad ya conocida de la descarga de fotos de Alegra. Por eso la comparación del resto se hizo por contenido (ningún otro artículo desapareció) y no por número de páginas.
4. **La portada del catálogo difiere de `docs/Cat.pdf`**: el título «Catálogo de productos» aparece sobre una caja negra con borde rosa, el logo es más pequeño y el teléfono no lleva los íconos de WhatsApp. Es **idéntica en el catálogo del 4 de octubre**, anterior a las features 005 y 006, y el visor usado (pdf.js) puede no dibujar bien las sombras; conviene revisarla en un visor real contra el principio IV. No la causa esta feature.
