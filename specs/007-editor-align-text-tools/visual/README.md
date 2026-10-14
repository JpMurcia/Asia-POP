# Revisión visual de la feature 007 (T024)

**Resultado: sin diferencias.** Con el código de la feature 007 terminado, las capturas de las 4 plantillas base
son idénticas byte a byte a la [línea base](./baseline/README.md) tomada antes de cambiar el render.

| Plantilla | Textos normales | Textos máximos (`LONG=1`) |
| --- | --- | --- |
| Neón Noche (`neon`) | 11 páginas idénticas | 11 páginas idénticas |
| Pop crema (`pop`) | 11 páginas idénticas | 11 páginas idénticas |
| Kawaii pastel (`kawaii`) | 11 páginas idénticas | 11 páginas idénticas |
| Kraft minimal (`kraft`) | 11 páginas idénticas | 11 páginas idénticas |

Las plantillas base no tienen `lh` ni `strike`, así que esto comprueba FR-015 y SC-003: los valores por defecto de
`TEXT_DEFAULTS` reproducen exactamente el render anterior. La línea base es determinista (dos corridas de `neon`
idénticas antes de cambiar el código), así que la igualdad no es casual.

La fidelidad de los valores **no** por defecto (altura de línea 1,6 y tachado en un texto de tres líneas) la cubre
`backend/tests/integration/pdf-template-fidelity.test.ts` en Chrome real.
