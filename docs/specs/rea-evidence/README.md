# Evidencia REA del editor de Canva

Capturas y árboles de accesibilidad tomados con REA (`rea-agents@6.7.0`) sobre el editor de Canva en Vivaldi
(`--remote-debugging-port=9222`), diseño "Documento A4 Catálogo Nueva Colección Elegante Beige", 2026-10-22.
Este archivo lista qué hay y cómo regenerarlo. Las PNG son capturas de la interfaz de Canva solo como referencia
de medidas: conviene no subirlas al repositorio (no están en `.gitignore`).

| Archivo | Estado | Herramienta |
| --- | --- | --- |
| `01-editor-sin-seleccion.png` | (a) nada seleccionado | `capture_web_screenshot` |
| `02-texto-seleccionado.png` / `.ax.txt` | (b) texto seleccionado, barra contextual | `capture_browser_scenario` (clic) |
| `03-avanzada.png` | panel "Configuración avanzada" del texto | `capture_browser_scenario` |
| `03-posicion.png` | panel "Posición" (Organizar, Alinear a la página, Avanzados) | `capture_browser_scenario` |
| `03-alinear.png` | **efecto del clic en alinear: cambia la alineación** (no abre menú) | `capture_browser_scenario` |

## Hallazgos medidos (verificado con REA)

- Barra contextual de texto (orden): fuente, tamaño (− / combo / +), color, Negrita, Itálica, Subrayar, **Tachado**,
  Mayúscula, **un solo botón de alineación** que cicla ("Alineación actual: …"), Lista, Configuración avanzada,
  Transparencia, Efectos, Animar, Posición, Copiar estilo.
- "Configuración avanzada": **Interletrado** (control deslizante + campo, valor 0) e **Interlineado** (control
  deslizante + campo, valor 1), **Anclar la caja de texto** (arriba / medio / abajo) y "Más opciones de configuración".
- "Posición": pestañas Organizar y Capas; Delante / Detrás / Al frente / Al fondo; **Alinear a la página** con seis
  botones (Arriba, En medio, Abajo, Izquierda, Centro, Derecha) en cuadrícula de 2 columnas; Avanzados: Ancho, Alto,
  Relación, X, Y, Girar.
- Interlineado por defecto de Canva: **1**. Medido con las teclas Inicio, Fin y flecha del deslizador y escribiendo
  en el campo: **rango 0,5–2,5, paso 0,01**. El campo acepta 1,05 tal cual y recorta 9 a 2,5. La feature 007 usa
  rango 0,8–2,5, paso 0,05 y valor por defecto 1,05.
- Interletrado: **rango −200 a 800, paso 1**, valor por defecto 0 (la 007 no lo tiene).
- Anclar la caja de texto: tres botones (comienzo, medio, final), con "final" activo en el texto probado.
- Con un elemento de fondo de página seleccionado (Escape + Tab), la barra muestra: Editar, Reemplazar, Color,
  Animar, Posición, Copiar estilo, Comentar. La barra del texto no tiene "Reemplazar".

## No verificado

- Colores, tipografía y espaciado en px del chrome del editor: REA pasivo no entrega estilos computados.
- Estados (c) forma, (d) imagen, (e) menú desplegable y (f) cajón cerrado: pendientes. Los clics automáticos sobre
  imágenes y formas fallan por tiempo agotado (Canva las cubre con una capa de interacción); el texto sí se puede
  seleccionar. Hace falta que la persona seleccione la imagen o la forma a mano y REA capture.

## Incidente

El clic en el botón de alineación **modificó** el diseño de prueba (texto "Camisa Margarita" pasó a Centrado) y se
guardó solo. Se revirtió a "A la izquierda" y se verificó con el árbol de accesibilidad. En adelante, solo se hacen
clics que abren paneles o seleccionan, nunca los que cambian propiedades.

## Cómo regenerar

`npx rea-agents list-browser-targets http://127.0.0.1:9222`, y después `capture_web_screenshot` o
`capture_browser_scenario` (modo `connect`, `after_each_step: ["screenshot"]`). Con `accessibility` el resultado pesa
varios MB: guardarlo a archivo y procesarlo con un script.

## Segunda ronda (2026-10-22): formas, imágenes, menús y cajón

| Archivo | Estado |
| --- | --- |
| `04-imagen-seleccionada.png` | (d) imagen seleccionada |
| `05-cajon-cerrado.png` | (f) cajón cerrado (clic otra vez en la pestaña activa) |
| `06-menu-archivo.png` | (e) menú desplegable Archivo abierto |
| `07-cajon-elementos.png` | cajón Elementos abierto |

Barras contextuales medidas (verificado con REA, árbol de accesibilidad):

- **Forma**: Reemplazar, Color, Estilo del trazo, Transparencia, Efectos, Animar, Posición, Copiar estilo.
- **Imagen**: Editar, Reemplazar, Quitafondos (Pro), Estilo del trazo, Redondeado de esquinas, Recortar, Voltear,
  Transparencia, Animar, Posición, Copiar estilo. La imagen y la forma no tienen Efectos de texto.
- **Texto**: ver arriba; es la única con fuente, tamaño, B/I/U/S, mayúscula, alineación, lista y Configuración avanzada.
- Además, el elemento seleccionado muestra una **barra flotante propia** (comentar, bloquear, duplicar, eliminar, más).

Medidas estimadas de las capturas (1879 × 914 px, **no** estilos computados; ± 2 px):

- Barra superior: 57 px de alto, degradado azul a morado, con acciones a la izquierda y Compartir a la derecha.
- Riel lateral: 72 px de ancho, ocho pestañas con ícono sobre texto.
- Cajón: **360 px** de ancho (de x = 72 a x = 432), con botón de colapsar en el borde derecho.
- Barra contextual: flotante, centrada sobre el lienzo, ~40 px de alto, fondo blanco, esquinas redondeadas y sombra.
- Pie: ~40 px, con Notas, Temporizador, zoom, Páginas y cuadrícula.
- Menú Archivo: tarjeta de ~335 px de ancho que se abre bajo la barra superior, con secciones separadas por línea.

Prueba de escritura (el diseño es una plantilla de prueba): para seleccionar una imagen o forma hay que insertarla
desde Elementos (botones "Agrega una foto de … al editor" / "Agrega un elemento gráfico de … al editor"); el clic
directo sobre las del lienzo se agota por tiempo. Quedaron en la plantilla de prueba un círculo y un marco de foto.

## Tercera ronda: paneles de texto (fuente, color, efectos, transparencia)

Archivos: `08-panel-fuente.png`, `09-panel-color.png`, `10-panel-efectos.png`, `11-transparencia.png`.
Todo observado con clics que solo abren paneles (verificado con REA, captura).

- **Patrón general**: cada botón de la barra contextual abre un **panel lateral en el cajón de 360 px** que reemplaza al
  anterior (Fuente, Color del texto, Efectos, Posición), con título a la izquierda y una **X** de cierre a la derecha.
  Los ajustes numéricos pequeños (Transparencia, Configuración avanzada) abren una **tarjeta flotante bajo el botón**,
  no un panel.
- **Fuente**: dos pestañas (Fuente, Estilo); buscador con filtros; chips de estilos rápidos; listas "Fuentes del
  documento", "Fuentes recomendadas" y "Kit de Marca"; cada fuente se muestra **con su propio nombre dibujado en esa
  fuente** y una marca de verificación en la activa; botón "Subir fuente" al pie.
- **Color del texto**: buscador por nombre o código hexadecimal; fila con "agregar color" y cuentagotas; "Colores del
  texto" y "Colores del diseño" (los que ya usa el diseño); Kit de Marca; paleta tomada de las fotos del diseño; colores
  sólidos predeterminados. Es la idea más reutilizable: **ofrecer primero los colores que ya están en la plantilla**.
- **Efectos**: cuadrícula de tres columnas con vista previa de cada efecto sobre las letras "Ag": Paralela, Brillo,
  Eco, Contorno, Fondo, Desalineado, Sin relleno, Neón, Distorsión; sección "Forma" con Curvar; sección "Avanzado" con
  efectos combinados. Asia-POP ya tiene contorno y resplandor; **sombra y fondo de texto** no existen.
- **Transparencia**: tarjeta con deslizador y campo numérico, **0 a 100**, valor inicial 100 (Asia-POP guarda 0 a 1).
- Los ajustes que no se usan a diario (interletrado, interlineado, anclaje) están escondidos en un panel; los de uso
  diario (fuente, tamaño, color, B/I/U/S, alineación) van siempre a la vista.

No verificado: Animar, Lista y el panel Estilo de la fuente (no se abrieron o no se alcanzaron a capturar).

## Cuarta ronda: riel lateral completo, zoom y barra de páginas

Archivos: `12-cajon-texto.png`, `13-cajon-marca.png`, `14-herramientas.png`, `15-zoom-opciones.png`,
`16-tira-de-paginas.png`, `17-vista-cuadricula.png`. **No se guardan** las capturas de "Plantillas" (plantillas de
terceros) ni de "Archivos subidos" (muestra fotos personales de la cuenta).

- **Riel (8 pestañas)**: Plantillas, Elementos, Texto, Marca, Archivos subidos, Herramientas, Proyectos, Apps. Cada una
  abre un cajón con **buscador arriba**; la pestaña activa se tiñe de color y se vuelve a pulsar para cerrar.
- **Texto**: buscador de fuentes y combinaciones; botón principal **"Agregar caja de texto"**; "Texto mágico"; Kit de
  Marca; **estilos predeterminados** (título, subtítulo, cuerpo) con vista previa en su tamaño relativo; **texto
  dinámico** (números de página); combinaciones de fuentes.
- **Marca**: submenú vertical (Todos los recursos, Pautas, Plantillas, Logos, Colores, Fuentes, Voz, Fotos,
  Componentes, Elementos gráficos, Íconos, Gráficos). Es un producto de pago; solo importa la idea de un **kit de
  marca** (logo, colores, fuentes) reutilizable.
- **Archivos subidos**: "Subir archivos", pestañas Imágenes / Carpetas, buscador, cuadrícula de miniaturas.
- **Herramientas**: una **barra flotante vertical** con íconos (selección, resaltador, formas, línea, nota, texto,
  firma, tabla); se cierra con una X.
- **Zoom**: control deslizante + porcentaje; al abrir el porcentaje, lista **300, 200, 125, 100, 75, 50, 25, 10 %** y
  las opciones "Reducir" y "Ampliar" (con marca de verificación en la activa).
- **Tira de páginas**: botón "Páginas" despliega miniaturas numeradas **bajo el lienzo** con la activa resaltada y un
  botón "+" con flecha para agregar. "Vista de cuadrícula" muestra todas las páginas grandes, con barra
  "Seleccionar todo / duplicar / eliminar / ocultar / más" y un ícono de impresora junto a cada número.
- **Controles de cada página** (sobre su borde superior): subir, bajar, ocultar, bloquear, duplicar, eliminar y agregar.

## Quinta ronda: plantilla base «PRUEBA CATALOGO» (2026-10-22)

Análisis completo en `docs/specs/canva-base-template-analysis.md`. Capturas (son del diseño del negocio; no subirlas
al repositorio sin decidirlo): `18-base-vista-cuadricula.png`, `19-base-pagina-producto-agotado.png`,
`20-base-portada-general.png`, `21-base-app-productos.png`, `22-base-efectos-burbuja.png`.

Resumen medido: A4 de 21 × 29,7 cm, 42 páginas; todos los textos con interlineado 1,4, interletrado 0 y anclaje al
comienzo; Poppins (título 32 en mayúsculas, descripción 14, precio 21 `#C04B0F` con neón 100) y Open Sans 58 para la
cinta AGOTADO (`#FF3131`, giro −45°, neón 50); burbuja `#E7DECF` con radio 51; foto-tarjeta 6,10 × 8,03 cm con el
nombre del producto ya dibujado en la imagen; logo 4,06 cm a 0,3 cm del borde derecho. Aprendizajes de método:
los clics directos sobre descripciones, imágenes y formas se agotan; se entra por **Posición → Capas**.

## Sexta ronda: exportación, impresión y estructura completa de la base (2026-10-22)

Especificación completa en `docs/specs/canva-base-template-spec.md`. Medido solo con el árbol de accesibilidad (no se
guardaron capturas nuevas): menú Archivo y submenús (Visualización, Reglas y guías, Imprimir), panel **Descargar**
(8 formatos; PDF con valores predefinidos Digital e Impresión; perfil RGB o CMYK; sangrado y marcas de corte;
aplanar; incluir notas; seleccionar páginas), panel **Compartir**, panel **Redimensionar**, lista de zoom y las
páginas 1 a 12 completas. **No se descargó ningún archivo.** Límites del método: los clics sobre capas cubiertas
(portadas, imágenes) se agotan por tiempo, y Canva solo dibuja las páginas cercanas a la vista (las páginas 28 a 42
exigen desplazarse a mano).
