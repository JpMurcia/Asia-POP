# Implementation Plan: Generador de Catálogo PDF ASIANPOP MARKET+

**Branch**: `001-catalog-pdf-generator` (sin repositorio git aún) | **Date**: 2026-10-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-catalog-pdf-generator/spec.md`

## Summary

Aplicación web local (React en `localhost`) que lee productos de Alegra en modo solo lectura, los combina con secciones, productos y combos propios guardados en SQLite, y genera un PDF A4 fiel a `docs/Cat.pdf`. El PDF se produce con un navegador headless (Puppeteer) que imprime **la misma vista React** usada en la vista previa. La generación es manual, en dos pasos (preparar y revisar → generar), con alertas de ítems sin categoría, ítems sin imagen y combos con componentes agotados. Acceso por login de un usuario semilla; el token de Alegra se guarda cifrado. Decisiones en [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript 5.x (estricto), Node.js 22 LTS

**Primary Dependencies**: Backend: Express, better-sqlite3, Puppeteer, zod (validación), multer (carga de imágenes). Frontend: React 18, Vite, Tailwind CSS, React Router

**Storage**: SQLite (`data/app.db`); archivos locales en `data/image-cache/`, `data/uploads/`, `data/output/`

**Testing**: Vitest (backend y frontend), supertest (API), servidor Alegra simulado, `pdf-parse` para verificar PDF; revisión visual manual contra `docs/Cat.pdf`

**Target Platform**: Windows 11 (equipo del usuario), navegador moderno en `localhost`

**Project Type**: web-application (frontend + backend, un solo proceso en producción)

**Performance Goals**: catálogo de hasta 200 productos en < 2 min (SC-002); pantallas administrativas con respuesta < 1 s

**Constraints**: escucha solo en `127.0.0.1`; sin infraestructura externa; token cifrado; un solo trabajo de generación a la vez; sin PDF parcial

**Scale/Scope**: un usuario, ~200 productos de Alegra, ~40 páginas A4, ~10 pantallas

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cumplimiento | Estado |
| --- | --- | --- |
| I. Alegra solo lectura | Cliente solo usa `GET`; correcciones en `category_override`; datos de Alegra no se persisten | ✅ |
| II. El catálogo nunca engaña | Reglas de stock, imagen, precio y combos en `data-model.md`; fallos abortan sin PDF parcial | ✅ |
| III. Seguridad de credenciales | AES-256-GCM, login, cookie `httpOnly`, `127.0.0.1`, enmascarado de logs, semillas en `.env` ignorado | ✅ |
| IV. Fidelidad visual | Vista de impresión React única; A4 por `@page`; componentes reciben datos y tema por props | ✅ |
| V. Pruebas sobre reglas | Vitest + Alegra simulado para stock, paginación, combos, overrides | ✅ |
| VI. Simplicidad | Un proceso, SQLite, un motor de PDF, sin colas ni n8n; generación manual | ✅ |

Re-evaluación tras el diseño (Fase 1): sin violaciones. Se sustituyó el SSR del SDD por la vista de impresión compartida, lo que reduce complejidad.

## Project Structure

### Documentation (this feature)

```text
specs/001-catalog-pdf-generator/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── rest-api.md
└── tasks.md             # lo crea /speckit-tasks
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── config/          # carga de .env, cifrado (AES-GCM)
│   ├── auth/            # login, sesión, límite de intentos
│   ├── db/              # conexión SQLite y migraciones numeradas
│   ├── alegra/          # cliente HTTP, paginación, tipos, normalización
│   ├── catalog/         # reglas (stock, imagen, categoría), paginación 3x, combos, ReviewReport
│   ├── custom/          # secciones, productos propios, combos, overrides (repositorios)
│   ├── pdf/             # job único, cola de imágenes, Puppeteer
│   ├── api/             # rutas Express y validación zod
│   └── server.ts
└── tests/
    ├── unit/            # reglas de negocio, cifrado, precios de combo
    ├── integration/     # API con supertest y Alegra simulado, PDF de muestra
    └── fixtures/        # respuestas simuladas de Alegra

frontend/
├── src/
│   ├── pages/           # Login, Panel, Alegra, Secciones, Productos propios, Combos, Sin categoría, Generar, Historial, Print
│   ├── components/      # formularios, alertas, tablas
│   ├── print/           # CoverPage, SectionCover, ProductCard, CatalogPage, CustomSectionPage, TermsPage (A4)
│   ├── services/        # cliente de la API
│   └── styles/          # tema neón, fuentes locales, @page
└── tests/

data/                    # creado en ejecución (ignorado por git)
.env.example
```

**Structure Decision**: aplicación web con dos paquetes (`backend`, `frontend`) en un monorepo con workspaces de npm. En producción el backend sirve el frontend compilado, por lo que corre un solo proceso. Los componentes de `frontend/src/print/` sirven tanto para la vista previa como para el PDF.

## Complexity Tracking

Sin violaciones de la constitución; no se requiere justificación.
