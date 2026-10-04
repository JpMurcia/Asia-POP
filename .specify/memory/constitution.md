<!--
Sync Impact Report
- Version change: 1.0.0 → 1.1.0 (MINOR: la guía del principio IV se amplía y se acota materialmente;
  ningún principio se elimina ni se redefine de forma incompatible: el PDF actual sigue cumpliendo)
- Principios modificados:
  - IV "Fidelidad visual al catálogo de referencia": la exigencia de seguir docs/Cat.pdf pasa a la plantilla
    predeterminada de fábrica (Neón Noche); las plantillas que cree o elija el responsable son personalizaciones.
    Se agrega que editor, vista previa y PDF dibujan con el mismo componente de página. Se corrige la
    descripción del diseño de referencia (portadas moradas, páginas de producto sobre mármol, tarjetas oscuras
    y acentos neón; antes decía solo "fondo oscuro").
  - II "El catálogo nunca engaña al cliente": "sello AGOTADO" pasa a "indicación AGOTADO (sello, cinta o
    etiqueta según el estilo de la plantilla)", para que los tres estilos de agotado de la feature 003 cumplan.
- Secciones modificadas: Flujo de Desarrollo (la verificación visual compara Neón Noche con Cat.pdf y las
  demás plantillas con el mockup)
- Secciones agregadas / eliminadas: ninguna
- Motivo: feature 003-catalog-template-editor (editor visual de plantillas); tres de sus cuatro plantillas
  base tienen fondo claro y el texto 1.0.0 las habría contradicho. Decidido en specs/003-.../plan.md.
- Plantillas: ✅ plan-template.md (su "Constitution Check" lee este archivo, sin cambios),
  ✅ spec-template.md, ✅ tasks-template.md (sin cambios necesarios); no existe .specify/templates/commands/
- Documentos: ✅ specs/003-catalog-template-editor/{plan,spec}.md actualizados; las specs 001 y 002 son
  históricas y no se tocan; docs/Alegra integracion.md ya está marcado como documento histórico
- TODOs diferidos: ninguno
-->

<!-- Historial: 1.0.0 (2026-10-02) ratificación inicial -->

# Asia-POP Catalog Generator Constitution

## Core Principles

### I. Alegra es la fuente de verdad (solo lectura)
Los productos, precios, categorías e inventario provienen de Alegra y el sistema NUNCA los modifica
en Alegra en esta etapa. Las correcciones locales (asignar sección a un ítem sin categoría) se
guardan solo en el sistema como overrides. Los productos propios (mochis, combos) viven en el
sistema y nunca se mezclan con los datos de Alegra en el almacenamiento.
Razón: evita corromper la contabilidad real de la tienda con un generador de catálogos.

### II. El catálogo nunca engaña al cliente
Cada regla de negocio visible en el PDF es explícita y verificable:
- Inventario `<= 0` en un ítem que controla stock MUST mostrar la indicación AGOTADO (sello, cinta o
  etiqueta, según el estilo de la plantilla; en todos los casos con la palabra AGOTADO); un ítem que
  no controla inventario MUST mostrarse como disponible.
- Ítems sin imagen MUST quedar fuera del PDF, y el sistema MUST informar cuáles y cuántos.
- Precios MUST formatearse en pesos colombianos (`$9.000`).
- Un combo con un componente agotado MUST generar una alerta; el usuario decide mantenerlo con la
  indicación AGOTADO o excluirlo.
- Un fallo de Alegra o de renderizado MUST abortar la generación; nunca se entrega un PDF parcial.
Razón: el catálogo se envía a clientes; un precio o estado incorrecto genera pérdidas y reclamos.

### III. Seguridad de credenciales (NO NEGOCIABLE)
El token de Alegra MUST almacenarse cifrado, MUST NOT mostrarse tras guardarse, y MUST NOT
aparecer en logs, respuestas ni mensajes de error. Todas las pantallas y endpoints MUST exigir
sesión. Las credenciales de acceso semilla son fijas, no editables desde la aplicación y NO se
versionan en el repositorio (van en configuración local). El servicio MUST escuchar solo en
`localhost`.
Razón: el token da acceso a la contabilidad completa de la tienda.

### IV. Fidelidad visual al catálogo de referencia
El PDF MUST ser A4, con máximo 3 productos por página, portada, portada por sección y página de
políticas. La plantilla predeterminada de fábrica (Neón Noche) MUST seguir `docs/Cat.pdf`: portadas
moradas, páginas de producto sobre mármol, tarjetas oscuras y acentos neón. El responsable puede
crear y elegir otras plantillas; son personalizaciones suyas y no se comparan con `docs/Cat.pdf`.
Editor, vista previa y PDF MUST dibujar con el mismo componente de página y recibir datos y
plantilla por parámetros. Los cambios en Neón Noche o en el render se validan comparando el PDF con
`docs/Cat.pdf`.
Razón: `docs/Cat.pdf` es la identidad de marca ya aprobada por el negocio; las plantillas adicionales
dan libertad sin romper esa base, y un único componente de página garantiza que lo que se edita es
lo que se imprime.

### V. Pruebas sobre las reglas de negocio
Las reglas de la sección II, la paginación (categorías con 0, 1, 3 y 4 productos), la paginación
de la API de Alegra, el cálculo de precios de combos (fijo y descuento) y los overrides de
categoría MUST tener pruebas automatizadas escritas antes o junto con su implementación. Las
pruebas contra Alegra usan respuestas simuladas; nunca se ejecutan contra la cuenta real de
forma automática.
Razón: son reglas con impacto económico y fáciles de romper al refactorizar.

### VI. Simplicidad (YAGNI)
Se implementa solo lo que pide la spec vigente. Una sola aplicación local, un único motor de PDF,
persistencia local embebida y sin infraestructura externa (colas, orquestadores como n8n, bases
de datos servidoras). Generación solo manual hasta que se decida lo contrario. Cualquier
complejidad adicional MUST justificarse por escrito en el plan.
Razón: un solo usuario, un solo equipo; la mantenibilidad pesa más que la escalabilidad.

## Restricciones Técnicas y de Seguridad

- Lenguaje: TypeScript en modo estricto en todo el código.
- Interfaz web en React servida en `localhost`; el procesamiento con Alegra, la persistencia y la
  generación de PDF ocurren en un proceso local, nunca en el navegador.
- Generación de PDF mediante navegador headless con fondos activados y tamaño de página definido
  por CSS (`@page`); fuentes e imágenes locales o descargadas con timeout antes de renderizar.
- El cliente de Alegra MUST paginar, respetar límites de peticiones y manejar errores 401 y 429
  con mensajes claros.
- Los secretos y datos semilla viven en variables de entorno o archivos locales ignorados por
  git; `.env.example` documenta los nombres sin valores reales.
- Idioma de la interfaz y del catálogo: español (Colombia).

## Flujo de Desarrollo

- El trabajo sigue Spec Kit: constitución → spec → clarify → plan → tasks → implement.
- `docs/Alegra integracion.md` es el documento de diseño base; si contradice la spec vigente,
  prevalece la spec y el documento se actualiza.
- Cada historia de usuario de la spec MUST poder probarse de forma independiente.
- Antes de dar una tarea por terminada, se ejecutan las pruebas y se verifica visualmente el PDF
  cuando la tarea afecte el diseño: la plantilla Neón Noche contra `docs/Cat.pdf`, y las demás
  plantillas contra su diseño en el mockup.
- Los datos reales de la tienda (token, catálogos con datos privados) no se incluyen en commits
  ni en la documentación.

## Governance

Esta constitución prevalece sobre otras prácticas del proyecto. Toda enmienda MUST documentarse
con su razón, actualizar la versión y revisar la consistencia con las plantillas de `.specify/`.
Versionado semántico: MAJOR por eliminar o redefinir un principio de forma incompatible, MINOR
por agregar un principio o ampliar materialmente una guía, PATCH por aclaraciones. Cada plan
MUST pasar el "Constitution Check" contra estos principios, y las excepciones se justifican en
la tabla de complejidad del plan. La guía de ejecución diaria está en `CLAUDE.md`.

**Version**: 1.1.0 | **Ratified**: 2026-10-02 | **Last Amended**: 2026-10-03
