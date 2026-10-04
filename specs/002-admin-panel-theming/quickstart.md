# Quickstart: validación de la feature 002

Escenarios para comprobar la feature de punta a punta. Detalle de endpoints en [contracts/rest-api.md](./contracts/rest-api.md) y de datos en [data-model.md](./data-model.md).

## Prerrequisitos

- Feature 001 funcionando: `.env` con `SEED_USERNAME`, `SEED_PASSWORD`, `ENCRYPTION_KEY`; dependencias instaladas con `npm install`.
- Fuentes nuevas instaladas (`@fontsource/fredoka`, `@fontsource/nunito-sans`) y logo copiado a `frontend/src/assets/logo.jpg`.
- Para escenarios sin cuenta real: servidor simulado de Alegra (`backend/tests/fixtures/dev-mock.ts`), con al menos: un ítem sin categoría, productos agotados, un combo con componente agotado en una sección y otro en otra.

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

1. **Inicio y navegación Pop (US1)**. Inicia sesión. Verifica fondo crema, barra lateral morada con las entradas Inicio, Conexión Alegra, Sin categoría, Contenido propio, Combos, Generar catálogo, Historial y Apariencia, ítem activo en ámbar, títulos redondeados e indicador de conexión. Inicio muestra los cuatro indicadores, las secciones y el último catálogo. Compara con `docs/Diseño de catálogo y administración/Admin Catalogo.dc.html` (dirección 1b).
2. **Contador de alertas (US1)**. Con un ítem sin categoría en el simulado, "Sin categoría" muestra el número e Inicio ofrece el acceso directo. Asígnale una sección: el contador baja sin esperar 60 s.
3. **Alegra caído (US1)**. Apaga el simulado: el indicador pasa a "sin conexión", Inicio sigue cargando con los indicadores no disponibles y el último catálogo sigue descargable.
4. **Opciones y estructura (US2)**. En Generar catálogo pulsa *Preparar*. Aparece la lista de secciones (todas marcadas). Desmarca una y activa *Ocultar productos agotados*: la vista previa de estructura cambia al instante, sin nueva consulta a Alegra. Cambia el texto del banner.
5. **Estructura = PDF (US2)**. Genera y abre el PDF: portadas, páginas de productos y políticas coinciden con la estructura; la portada muestra el banner personalizado; la sección desmarcada no aparece. Al volver a abrir Generar, el campo de banner vuelve al texto guardado.
6. **Combos y secciones desmarcadas (US2)**. Con un combo agotado en la sección A: desmarca A y verifica que no se pide decisión ni aparece su alerta. Marca A y activa *Ocultar agotados*: el combo se omite sin preguntar. Marca A y desactiva *Ocultar agotados*: se pide mantener u omitir, y "omitir" no lo vuelve a incluir en el PDF.
7. **Catálogo vacío (US2)**. Desmarca todas las secciones: se informa "nada que generar", la estructura queda en cero y *Generar* se deshabilita.
8. **Editar tema (US3)**. En Apariencia cada color indica qué elemento cambia. Cambia el acento rosa: la muestra cambia sin guardar. Guarda, genera y verifica el nuevo color en el contorno de los títulos de sección y en los encabezados de políticas. Cambia también el fondo y verifica la tarjeta de imagen, la etiqueta de precio y el pie.
9. **Validaciones del tema (US3)**. Escribe `rosa` o `#12G`: se rechaza y se conserva el tema anterior. Usa un fondo claro: aparece advertencia de contraste pero permite guardar.
10. **Restaurar, cambios sin guardar y pestañas (US3)**. *Restaurar valores originales* devuelve `#11052C / #FF007A / #00FF66 / #FF9900` y el siguiente PDF los usa. Edita y cierra la pestaña o navega desde la barra: aparece el aviso. Con dos pestañas abiertas, guarda en una y luego en la otra: la segunda recibe "el tema cambió, recarga".
11. **Tema guardado entre preparar y generar (US3)**. Prepara, cambia el tema, genera: el PDF usa el tema nuevo, y la vista previa también.
12. **Fidelidad del PDF (US4)**. Con el tema por defecto compara página por página con `docs/Cat.pdf`: máx. 3 tarjetas, sello AGOTADO, precio, pie con `310 669 0585`, `318 807 0709` y `Cra 10 # 18-15 centro` en las páginas de producto y de políticas, portadas con su bloque "Domicilios". Prueba nombres, descripciones, políticas, dirección del pie, introducción de sección y banner muy largos: nada desborda.
13. **Seguridad y rendimiento**. Sin sesión, `GET /api/settings/theme`, `/api/panel/summary` y `PUT /api/catalog/prepare/x/options` devuelven `401`. El token de Alegra no aparece en ninguna respuesta nueva. Mide: estructura recalculada < 1 s, Inicio < 2 s con caché, cambio de color a PDF < 3 min.

## Criterios de salida

- Todos los escenarios pasan y `npm test` queda en verde.
- El responsable de la tienda aprueba la revisión visual del panel (contra el mockup 1b) y del PDF (contra Cat.pdf) — SC-001 y SC-007.
