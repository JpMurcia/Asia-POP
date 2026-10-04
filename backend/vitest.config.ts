import { defineConfig } from 'vitest/config';
// Varias pruebas abren Chrome real: con todas en paralelo la máquina se satura (un PDF que tarda 2 s tarda 15 s) y
// cerrar el navegador y el servidor puede pasar de 10 s. Se limita el paralelismo y se amplía el plazo de los hooks.
export default defineConfig({
  test: { include: ['tests/**/*.test.ts'], testTimeout: 60000, hookTimeout: 120000, maxWorkers: 4 },
});
