# Specification Quality Checklist: PDF del catálogo liviano para enviar

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-10-04
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- **Iteración 1 (2026-10-04)**: quedaba **1** marcador `[NEEDS CLARIFICATION]`, el tamaño objetivo (FR-003), que el responsable pidió dejar abierto. Cuatro ítems fallaban solo por esa causa.
- **Iteración 2 (2026-10-04)**: el responsable eligió **25 MB** (opción A). Se reemplazó el marcador, se agregó la sección *Clarifications* y se fijaron los números derivados (SC-006: 250 MB para los 10 catálogos del Historial). Ya no queda ningún marcador y los 15 ítems pasan.
- «Sin detalles de implementación»: la spec menciona dos direcciones posibles (reducir las fotos al prepararlas o procesar el PDF ya generado) **solo en Supuestos y como pregunta para el plan**, no en los requisitos ni en los criterios de éxito.
- **Riesgo que el plan debe resolver primero**: 25 MB es una meta del responsable, no una medición. El plan debe medir la composición real del PDF (fotos, fondos, portadas, tipografías) y confirmar que 25 MB se alcanza con 150 ppp; si no, se vuelve a consultar antes de bajar la calidad (ver *Clarifications* y *Supuestos*).
- Valores por defecto asumidos sin preguntar, por tener una opción razonable: Optimizada preseleccionada, opción por generación (no un ajuste global), resolución mínima de 150 ppp, aviso (y no aborto) si el PDF supera el objetivo, y PDF anteriores sin tocar.
