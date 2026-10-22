import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';
import type { Template, WorkspaceState } from '../../backend/src/catalog/template';
import { BASE_TEMPLATES } from '../../backend/src/catalog/template-presets';
import { DEFAULT_BUSINESS } from '../../backend/src/catalog/settings.repo';
import TemplateEditor from '../src/pages/TemplateEditor';

export const json = (status: number, body?: unknown) => new Response(body === undefined ? null : JSON.stringify(body), { status });

export const initialWorkspace = (): WorkspaceState => ({
  templates: structuredClone(BASE_TEMPLATES),
  defaultId: 'neon',
  business: structuredClone(DEFAULT_BUSINESS),
  revision: 1,
});

export interface Call {
  url: string;
  method: string;
  body?: Record<string, unknown>;
}

type Handler = (body: Record<string, unknown> | undefined) => Response;

/** Simula la API de plantillas con un conjunto en memoria. `overrides` reemplaza una respuesta (`"PUT /api/..."`). */
export function mockEditorApi(overrides: Record<string, Handler> = {}, start: WorkspaceState = initialWorkspace()) {
  const calls: Call[] = [];
  let ws = structuredClone(start);
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined;
    calls.push({ url, method, body });
    const key = `${method} ${url}`;
    if (overrides[key]) return overrides[key]!(body);
    if (key === 'GET /api/settings/templates') return json(200, ws);
    if (key === 'PUT /api/settings/templates') {
      ws = {
        templates: body!.templates as Template[],
        defaultId: body!.defaultId as string,
        business: body!.business as WorkspaceState['business'],
        revision: ws.revision + 1,
      };
      return json(200, { ...ws, warnings: [] });
    }
    return json(404, { error: 'not_found', message: 'no' });
  });
  vi.stubGlobal('fetch', fetchMock);
  return { calls, puts: () => calls.filter((c) => c.method === 'PUT' && c.url === '/api/settings/templates'), workspace: () => ws };
}

/** Muestra el editor y espera a que cargue el conjunto. */
export async function renderEditor() {
  const view = render(
    <MemoryRouter initialEntries={['/apariencia']}>
      <Routes>
        <Route path="/apariencia" element={<TemplateEditor />} />
        <Route path="/" element={<p>Inicio del panel</p>} />
      </Routes>
    </MemoryRouter>,
  );
  await screen.findByTestId('template-editor');
  await screen.findByLabelText('Nombre de la plantilla');
  return view;
}

/** Hoja del lienzo (la página activa). */
export const canvas = () => screen.getByTestId('canvas-page');
export const canvasEl = (id: string) => canvas().querySelector<HTMLElement>(`[data-el-id="${id}"]`);
export const layers = () => screen.getByTestId('layers');

/** Elige una página de la tira inferior. */
export const goToPage = (label: string) => fireEvent.click(screen.getByRole('button', { name: label }));

/** Selecciona un elemento desde la lista de capas (sirve también para uno oculto). */
export function selectLayer(name: string | RegExp) {
  const row = within(layers()).getByRole('button', { name });
  fireEvent.click(row);
}

/** Agrega un elemento con los botones del panel Elementos. */
export function openElements() {
  fireEvent.click(screen.getByRole('button', { name: 'Elementos' }));
}

export const status = () => screen.getByTestId('save-status');
export const saveButton = () => screen.getByRole('button', { name: 'Guardar' });

/** Cambia el valor de un campo del inspector. */
export function setField(label: string | RegExp, value: string) {
  const input = screen.getByLabelText(label);
  fireEvent.change(input, { target: { value } });
}

export { fireEvent, screen, waitFor, within };

/** Abre el selector de color de un campo (si no lo está) y devuelve consultas sobre su panel (feature 009). */
export function colorPanel(field: string) {
  const button = within(screen.getByRole('group', { name: field })).getByRole('button', { name: new RegExp(`^${field}: `) });
  if (button.getAttribute('aria-expanded') !== 'true') fireEvent.click(button);
  return within(screen.getByRole('dialog', { name: `Color: ${field}` }));
}

/** Elige una muestra por su nombre («Acento 2», «Ninguno», «Transparente»…) en el selector de color del campo. */
export function pickColor(field: string, name: string) {
  fireEvent.click(colorPanel(field).getByRole('button', { name }));
}

/** Abre el selector de fuente (si no lo está) y devuelve consultas sobre su panel (feature 009). */
export function fontPanel() {
  const button = screen.getByRole('button', { name: /^Fuente: / });
  if (button.getAttribute('aria-expanded') !== 'true') fireEvent.click(button);
  return within(screen.getByRole('dialog', { name: 'Fuente' }));
}

/** Elige una fuente por su nombre («Bungee», «Título · Fredoka»…) en el selector de fuente. */
export function pickFont(name: string) {
  const panel = fontPanel();
  fireEvent.click(panel.getAllByRole('button', { name }).find((b) => b.getAttribute('aria-pressed') !== null)!);
}
