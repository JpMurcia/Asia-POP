# Línea base de la feature 007

Capturada el 2026-10-14, **antes** de cambiar el render, con `backend/tests/fixtures/visual-sample.ts` y el
Alegra simulado (tarea T001).

- `<plantilla>.pdf` y `<plantilla>-long.pdf`: PDF de cada plantilla base (`neon`, `pop`, `kawaii`, `kraft`), con
  textos normales y con `LONG=1` (textos en el máximo permitido).
- `png/<plantilla>[-long]/page-NN.png`: una captura por página. No se versionan (ver `.gitignore`); se regeneran con
  el mismo comando.

Comando, desde la raíz y con el frontend compilado (`npm run build`):

```bash
OUT=<carpeta> PDF=<archivo.pdf> TEMPLATE=<neon|pop|kawaii|kraft> LONG=<0|1> npx tsx backend/tests/fixtures/visual-sample.ts
```

**Determinismo comprobado**: dos corridas de `neon` dieron capturas idénticas byte a byte (11 páginas), así que
cualquier diferencia posterior se debe al código, no al azar.

## Estado de partida (T002)

- `npm test`: backend 57 archivos / 772 pruebas, frontend 21 archivos / 546 pruebas, todo en verde.
- `npm run lint`: sin errores.
