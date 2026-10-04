import { afterEach, describe, expect, it, vi } from 'vitest';
import { isDirty } from '../src/pages/TemplateEditor/useTemplateEditor';
import {
  canvas,
  canvasEl,
  fireEvent,
  goToPage,
  initialWorkspace,
  json,
  layers,
  mockEditorApi,
  renderEditor,
  saveButton,
  screen,
  selectLayer,
  setField,
  status,
  waitFor,
  within,
} from './editor-helpers';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Hace un cambio cualquiera: mueve X del Banner. */
const edit = (x = '20') => {
  // tras un cambio el Banner sigue seleccionado y entonces la lista de capas no se muestra
  if (screen.queryByTestId('layers')) selectLayer(/^Banner/);
  setField('X %', x);
};

describe('carga', () => {
  it('pide el conjunto y muestra la plantilla predeterminada, con la barra superior y las cuatro páginas', async () => {
    const api = mockEditorApi();
    await renderEditor();
    expect(api.calls[0]).toMatchObject({ method: 'GET', url: '/api/settings/templates' });
    expect(screen.getByLabelText('Nombre de la plantilla')).toHaveValue('Neón Noche');
    for (const label of ['Portada', 'Portada de sección', 'Productos', 'Políticas']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
    expect(canvas()).toBeInTheDocument();
    expect(status()).toHaveTextContent('Todo guardado');
  });

  it('"← Menú" lleva el logo de la tienda (como el mockup) sin cambiar su nombre accesible', async () => {
    mockEditorApi();
    await renderEditor();
    const back = screen.getByRole('button', { name: '← Menú' });
    const logo = back.querySelector('img');
    expect(logo, 'el botón trae el logo').not.toBeNull();
    expect(logo).toHaveAttribute('alt', '');
  });

  it('muestra "Cargando…" y, si el servidor falla, el error', async () => {
    mockEditorApi({ 'GET /api/settings/templates': () => json(500, { error: 'x', message: 'No se pudo leer la base.' }) });
    const { default: TemplateEditor } = await import('../src/pages/TemplateEditor');
    const { MemoryRouter } = await import('react-router-dom');
    const { render } = await import('@testing-library/react');
    render(
      <MemoryRouter>
        <TemplateEditor />
      </MemoryRouter>,
    );
    expect(await screen.findByText('No se pudo leer la base.')).toBeInTheDocument();
  });
});

describe('indicador de estado (FR-026)', () => {
  it('alterna "Cambios sin guardar" y "Todo guardado"', async () => {
    mockEditorApi();
    await renderEditor();
    expect(status()).toHaveTextContent('Todo guardado');
    edit();
    expect(status()).toHaveTextContent('Cambios sin guardar');
    fireEvent.click(saveButton());
    await waitFor(() => expect(status()).toHaveTextContent('Todo guardado'));
  });

  it('deshacer hasta el estado guardado lo deja en "Todo guardado"', async () => {
    mockEditorApi();
    await renderEditor();
    edit();
    fireEvent.click(screen.getByRole('button', { name: 'Deshacer' }));
    expect(status()).toHaveTextContent('Todo guardado');
  });

  it('Guardar solo está habilitado con cambios', async () => {
    mockEditorApi();
    await renderEditor();
    expect(saveButton()).toBeDisabled();
    edit();
    expect(saveButton()).toBeEnabled();
  });

  it('el nombre de la plantilla también cuenta como cambio', async () => {
    mockEditorApi();
    await renderEditor();
    setField('Nombre de la plantilla', 'Navidad');
    expect(status()).toHaveTextContent('Cambios sin guardar');
  });
});

describe('Guardar (FR-025)', () => {
  it('envía todo el conjunto con la revisión que recibió', async () => {
    const api = mockEditorApi();
    await renderEditor();
    edit();
    fireEvent.click(saveButton());
    await waitFor(() => expect(api.puts()).toHaveLength(1));
    const body = api.puts()[0]!.body!;
    expect(body.expectedRevision).toBe(1);
    expect(body.defaultId).toBe('neon');
    expect((body.templates as { id: string }[]).map((t) => t.id)).toEqual(['neon', 'pop', 'kawaii', 'kraft']);
    expect(body.business).toMatchObject({ storeName: 'ASIANPOP MARKET+' });
    const neon = (body.templates as { pages: { portada: { els: { id: string; x: number }[] } } }[])[0]!;
    expect(neon.pages.portada.els.find((e) => e.id === 'neon-p2')!.x).toBe(20);
  });

  it('la segunda vez envía la revisión nueva', async () => {
    const api = mockEditorApi();
    await renderEditor();
    edit('20');
    fireEvent.click(saveButton());
    await waitFor(() => expect(status()).toHaveTextContent('Todo guardado'));
    edit('30');
    fireEvent.click(saveButton());
    await waitFor(() => expect(api.puts()).toHaveLength(2));
    expect(api.puts()[1]!.body!.expectedRevision).toBe(2);
  });

  it('confirma con un aviso de que se usará en el próximo catálogo', async () => {
    mockEditorApi();
    await renderEditor();
    edit();
    fireEvent.click(saveButton());
    expect(await screen.findByTestId('toast')).toHaveTextContent(/próximo catálogo/i);
  });

  it('un 422 muestra los errores con su campo y conserva los cambios', async () => {
    mockEditorApi({
      'PUT /api/settings/templates': () =>
        json(422, {
          error: 'invalid_templates',
          message: 'Las plantillas no son válidas.',
          details: [{ field: 'templates[0].pages.productos.els[2].ringW', message: 'El grosor del anillo: el máximo es 10.' }],
        }),
    });
    await renderEditor();
    edit();
    fireEvent.click(saveButton());
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Las plantillas no son válidas.');
    expect(alert).toHaveTextContent('El grosor del anillo: el máximo es 10.');
    expect(alert).toHaveTextContent('templates[0].pages.productos.els[2].ringW');
    expect(status()).toHaveTextContent('Cambios sin guardar');
    expect(canvasEl('neon-p2')!.style.left).toBe('20%');
  });

  it('un 422 de los datos del negocio también se muestra', async () => {
    mockEditorApi({
      'PUT /api/settings/templates': () =>
        json(422, { error: 'invalid_business', message: 'Los datos del negocio no son válidos.', details: [{ field: 'coverTitle', message: 'Máximo 80 caracteres.' }] }),
    });
    await renderEditor();
    edit();
    fireEvent.click(saveButton());
    expect(await screen.findByRole('alert')).toHaveTextContent('Máximo 80 caracteres.');
  });

  it('un 409 pide recargar y no pisa los cambios hasta que el usuario lo decide', async () => {
    const api = mockEditorApi({
      'PUT /api/settings/templates': () => json(409, { error: 'templates_changed', message: 'Las plantillas cambiaron desde otra pestaña. Recarga la página.' }),
    });
    await renderEditor();
    edit();
    fireEvent.click(saveButton());
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/Recarga/);
    expect(canvasEl('neon-p2')!.style.left).toBe('20%'); // sigue editando lo suyo
    expect(status()).toHaveTextContent('Cambios sin guardar');
    // Recargar trae lo guardado (con una confirmación porque hay cambios)
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const gets = api.calls.filter((c) => c.method === 'GET').length;
    fireEvent.click(within(alert).getByRole('button', { name: 'Recargar' }));
    await waitFor(() => expect(api.calls.filter((c) => c.method === 'GET').length).toBe(gets + 1));
    await waitFor(() => expect(status()).toHaveTextContent('Todo guardado'));
    expect(canvasEl('neon-p2')!.style.left).toBe('6%');
  });

  it('Recargar no hace nada si el usuario no confirma descartar sus cambios', async () => {
    const api = mockEditorApi({
      'PUT /api/settings/templates': () => json(409, { error: 'templates_changed', message: 'Cambió.' }),
    });
    await renderEditor();
    edit();
    fireEvent.click(saveButton());
    const alert = await screen.findByRole('alert');
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const gets = api.calls.filter((c) => c.method === 'GET').length;
    fireEvent.click(within(alert).getByRole('button', { name: 'Recargar' }));
    expect(api.calls.filter((c) => c.method === 'GET').length).toBe(gets);
    expect(canvasEl('neon-p2')!.style.left).toBe('20%');
  });

  it('muestra las advertencias de contraste que devuelve el servidor sin bloquear', async () => {
    mockEditorApi({
      'PUT /api/settings/templates': (body) =>
        json(200, {
          ...initialWorkspace(),
          templates: body!.templates,
          revision: 2,
          warnings: [{ templateId: 'neon', code: 'low_text_contrast', message: 'El texto blanco puede no leerse sobre el color de fondo elegido.' }],
        }),
    });
    await renderEditor();
    edit();
    fireEvent.click(saveButton());
    expect(await screen.findByTestId('warnings')).toHaveTextContent('El texto blanco puede no leerse');
    expect(status()).toHaveTextContent('Todo guardado');
  });
});

describe('salir con cambios sin guardar (FR-026)', () => {
  it('"← Menú" sin cambios vuelve al panel sin preguntar', async () => {
    mockEditorApi();
    const confirm = vi.spyOn(window, 'confirm');
    await renderEditor();
    fireEvent.click(screen.getByRole('button', { name: /Menú/ }));
    expect(await screen.findByText('Inicio del panel')).toBeInTheDocument();
    expect(confirm).not.toHaveBeenCalled();
  });

  it('con cambios pendientes pide confirmación y, si se rechaza, se queda', async () => {
    mockEditorApi();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await renderEditor();
    edit();
    fireEvent.click(screen.getByRole('button', { name: /Menú/ }));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Inicio del panel')).not.toBeInTheDocument();
    expect(screen.getByTestId('template-editor')).toBeInTheDocument();
  });

  it('con cambios pendientes y confirmación, vuelve al panel', async () => {
    mockEditorApi();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await renderEditor();
    edit();
    fireEvent.click(screen.getByRole('button', { name: /Menú/ }));
    expect(await screen.findByText('Inicio del panel')).toBeInTheDocument();
  });

  it('cerrar o recargar la pestaña avisa solo con cambios pendientes', async () => {
    mockEditorApi();
    await renderEditor();
    const clean = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);
    edit();
    const dirty = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(dirty);
    expect(dirty.defaultPrevented).toBe(true);
  });

  it('tras guardar ya no avisa', async () => {
    mockEditorApi();
    await renderEditor();
    edit();
    fireEvent.click(saveButton());
    await waitFor(() => expect(status()).toHaveTextContent('Todo guardado'));
    const e = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(false);
  });
});

describe('Vista previa (FR-004)', () => {
  it('muestra las cuatro páginas lado a lado, sin marcos ni guías, y se puede volver a Editar', async () => {
    mockEditorApi();
    await renderEditor();
    selectLayer(/^Banner/);
    expect(screen.getByTestId('selection')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Vista previa' }));
    const preview = screen.getByTestId('preview-pages');
    for (const key of ['portada', 'seccion', 'productos', 'politicas']) {
      expect(within(preview).getByTestId(`preview-${key}`)).toBeInTheDocument();
    }
    for (const label of ['Portada', 'Portada de sección', 'Productos', 'Políticas']) expect(within(preview).getByText(label)).toBeInTheDocument();
    expect(screen.queryByTestId('selection')).not.toBeInTheDocument();
    expect(screen.queryByTestId('resize-handle')).not.toBeInTheDocument();
    expect(screen.queryByTestId('canvas-page')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    expect(screen.getByTestId('canvas-page')).toBeInTheDocument();
    expect(screen.queryByTestId('preview-pages')).not.toBeInTheDocument();
  });

  it('la vista previa usa datos de muestra: tres productos con uno agotado y el nombre de sección', async () => {
    mockEditorApi();
    await renderEditor();
    fireEvent.click(screen.getByRole('button', { name: 'Vista previa' }));
    const products = screen.getByTestId('preview-productos');
    expect(within(products).getAllByTestId('product-card')).toHaveLength(3);
    expect(products.querySelectorAll('[data-sold-out="true"]')).toHaveLength(1);
    expect(products).toHaveTextContent('Catálogo RAMEN');
  });
});

describe('lienzo y datos de muestra (FR-004)', () => {
  it('Productos muestra tres productos de muestra, uno agotado', async () => {
    mockEditorApi();
    await renderEditor();
    goToPage('Productos');
    expect(canvas().querySelectorAll('[data-testid="product-card"]')).toHaveLength(3);
    expect(canvas().querySelectorAll('[data-sold-out="true"]')).toHaveLength(1);
    expect(canvas()).toHaveTextContent('Catálogo RAMEN');
  });

  it('Portada muestra los datos reales del negocio', async () => {
    mockEditorApi();
    await renderEditor();
    expect(canvas()).toHaveTextContent('Catálogo de productos');
    expect(canvas()).toHaveTextContent('310 669 0585');
  });

  it('Políticas muestra las políticas reales y Portada de sección una introducción de ejemplo', async () => {
    mockEditorApi();
    await renderEditor();
    goToPage('Políticas');
    expect(canvas()).toHaveTextContent('Pedidos y Anticipación');
    goToPage('Portada de sección');
    expect(canvas().querySelector('[data-part="intro"]')).not.toBeNull();
  });

  it('la tira muestra una miniatura por página y marca la activa', async () => {
    mockEditorApi();
    await renderEditor();
    expect(screen.getByRole('button', { name: 'Portada' })).toHaveAttribute('aria-pressed', 'true');
    goToPage('Productos');
    expect(screen.getByRole('button', { name: 'Productos' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Portada' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getAllByTestId(/^thumb-/)).toHaveLength(4);
  });

  it('el zoom va de 20 % a 200 % y Ajustar lo devuelve al espacio disponible', async () => {
    mockEditorApi();
    await renderEditor();
    const label = () => screen.getByTestId('zoom-label').textContent;
    const fit = label();
    fireEvent.click(screen.getByRole('button', { name: 'Acercar' }));
    expect(Number.parseInt(label()!)).toBeGreaterThan(Number.parseInt(fit!));
    for (let i = 0; i < 30; i++) fireEvent.click(screen.getByRole('button', { name: 'Acercar' }));
    expect(label()).toBe('200%');
    for (let i = 0; i < 40; i++) fireEvent.click(screen.getByRole('button', { name: 'Alejar' }));
    expect(label()).toBe('20%');
    fireEvent.click(screen.getByRole('button', { name: 'Ajustar' }));
    expect(label()).toBe(fit);
  });
});

describe('deshacer y rehacer desde la barra', () => {
  it('los botones se deshabilitan sin pasos', async () => {
    mockEditorApi();
    await renderEditor();
    expect(screen.getByRole('button', { name: 'Deshacer' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Rehacer' })).toBeDisabled();
    edit();
    expect(screen.getByRole('button', { name: 'Deshacer' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Deshacer' }));
    expect(screen.getByRole('button', { name: 'Rehacer' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Rehacer' }));
    expect(canvasEl('neon-p2')!.style.left).toBe('20%');
  });
});

describe('estado puro', () => {
  it('isDirty de un conjunto recién cargado es falso', async () => {
    const { createEditorState } = await import('../src/pages/TemplateEditor/useTemplateEditor');
    const w = initialWorkspace();
    expect(isDirty(createEditorState({ templates: w.templates, defaultId: w.defaultId, business: w.business }, 1))).toBe(false);
  });
});

void layers;
