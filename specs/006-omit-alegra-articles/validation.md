# Validación: Omitir artículos de Alegra del catálogo

**Feature**: `006-omit-alegra-articles` | **Fecha**: 2026-10-05 | **Estado**: parcial (falta el escenario 8, con la cuenta real)

## Cómo se hizo

- **Escenarios 2 a 7 y 9** de [quickstart.md](./quickstart.md), con el simulador de Alegra (`backend/tests/fixtures/dev-mock.ts`) y la app compilada, en el navegador del panel.
- Instancia **aislada**: la app en el puerto 3100 con una carpeta `data` temporal y el simulador en el 3920. La carpeta `data/` real y la conexión real con Alegra no se usaron ni se modificaron.
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
| 8 | Cuenta real | ⏳ pendiente | Requiere la confirmación del responsable (usa sus credenciales y descarga las fotos de su tienda) |
| 9 | Alegra caído | ✅ | Con el simulador detenido, la pantalla muestra «No se pudo conectar con Alegra.», el enlace «Revisa la conexión con Alegra» (a `/alegra`) y el botón «Reintentar», sin lista |

## Limitaciones de esta validación

- El panel del navegador no llegó a dibujar la página (las capturas agotaron el tiempo de espera), así que **la apariencia visual no se revisó**; todo se comprobó leyendo el contenido y los atributos de la página y el texto de los PDF. Algunos clics se hicieron por script sobre los mismos botones. La revisión visual queda para el escenario 8, con la persona responsable.
- Que la lista guardada de omitidos siga intacta cuando Alegra no responde (FR-015) se comprueba en la prueba de integración `omitted-articles.test.ts`; aquí la lista estaba vacía al detener el simulador.
- Para el caso «todo omitido» se eliminó la sección propia MOCHIS de la instancia de prueba (solo en esos datos temporales).

## Observaciones

- Ninguna desviación funcional respecto al contrato.
- Quedaron sin cambios «Último catálogo» y su cuenta de «omitidos» en Inicio (significan sin foto o sin sección, como antes).
