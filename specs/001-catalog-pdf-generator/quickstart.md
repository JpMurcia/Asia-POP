# Quickstart: validar el Generador de Catálogo PDF

Guía para comprobar de extremo a extremo que la feature funciona. Contratos en [contracts/rest-api.md](./contracts/rest-api.md); entidades en [data-model.md](./data-model.md).

## Requisitos previos

- Node.js 22 LTS o superior y npm.
- Credenciales de Alegra (correo + token) de una cuenta con al menos: productos en 2 categorías, un producto con inventario en 0, un ítem sin imagen y un ítem sin categoría.
- `docs/Cat.pdf` a mano para comparar.

## Configuración

```bash
npm install
cp .env.example .env
```

Editar `.env` (no se versiona):

| Variable | Contenido |
| --- | --- |
| `PORT` | puerto local (por defecto 3000) |
| `SEED_USERNAME` / `SEED_PASSWORD` | usuario y contraseña fijos de acceso |
| `ENCRYPTION_KEY` | 32 bytes en base64 (`node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`) |

## Ejecutar

```bash
npm run build
npm start
```

Abrir `http://localhost:3000`.

## Escenarios de validación

| # | Escenario | Pasos | Resultado esperado |
| --- | --- | --- | --- |
| 1 | Login (US2) | Abrir la página sin sesión; ingresar datos incorrectos; luego los semilla | Redirige al login; error genérico; acceso con los correctos; cerrar sesión vuelve al login |
| 2 | Conexión (US3) | Ingresar credenciales inválidas, luego válidas | Rechazo con mensaje y conservación de las anteriores; con válidas confirma conexión y no muestra el token |
| 3 | Generar (US1) | Pulsar "Preparar" y luego "Generar" | PDF A4: portada, portada por sección, máx. 3 productos por página, sello AGOTADO en el producto sin stock, políticas al final |
| 4 | Sin imagen (US1) | Revisar el informe de revisión | El ítem sin imagen figura en "omitidos" y no está en el PDF |
| 5 | Sin categoría (US4) | Abrir la alerta de ítems sin categoría; asignarle una sección; regenerar | Aparece en la sección elegida; Alegra no cambia |
| 6 | Sección propia (US5) | Crear MOCHIS con un producto con sabores y cajas x6/x12 y una imagen | Aparece en el PDF con opciones y precios, sin sello AGOTADO |
| 7 | Combo (US6) | Crear un combo con 10 % de descuento y otro con precio fijo | Precios correctos en el PDF |
| 8 | Combo agotado (US6) | Incluir un componente con stock 0 y pulsar "Preparar" | Alerta por combo; pedir decisión; "mantener" muestra sello, "omitir" lo excluye |
| 9 | Concurrencia | Pulsar "Generar" dos veces seguidas | La segunda recibe "ya hay una generación en curso" |
| 10 | Fidelidad visual | Comparar el PDF con `docs/Cat.pdf` | Misma estructura: portada, secciones, páginas de producto, políticas (revisión manual, SC-008) |

## Pruebas automatizadas

```bash
npm test               # unitarias + integración (backend y frontend)
npm run test:pdf       # genera un PDF de muestra con datos simulados y verifica páginas y texto
```

Las pruebas de Alegra usan un servidor simulado local; nunca consultan la cuenta real.
