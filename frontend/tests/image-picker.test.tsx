import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ImagePicker from '../src/pages/TemplateEditor/ImagePicker';

/** Feature 010: «Mis imágenes» del inspector: elegir, subir y borrar imágenes de plantilla. */
const json = (status: number, body?: unknown) => new Response(body === undefined ? null : JSON.stringify(body), { status });
const img = (file: string, name = 'logo') => ({ file, name, bytes: 1200, width: 40, height: 20, src: `upload:${file}` });

function mockApi(handlers: Record<string, (init?: RequestInit) => Response>) {
  const calls: { key: string; init?: RequestInit }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const key = `${init?.method ?? 'GET'} ${url}`;
      calls.push({ key, init });
      return handlers[key]?.(init) ?? json(404, { error: 'not_found', message: 'no' });
    }),
  );
  return calls;
}
afterEach(() => vi.unstubAllGlobals());

describe('ImagePicker', () => {
  it('sin imágenes subidas lo dice y deja subir', async () => {
    mockApi({ 'GET /api/template-images': () => json(200, { images: [] }) });
    render(<ImagePicker value="logo" label="Mis imágenes" onPick={() => undefined} />);
    expect(await screen.findByText(/Todavía no subiste imágenes/)).toBeInTheDocument();
    expect(screen.getByLabelText('Subir imagen')).toBeInTheDocument();
  });

  it('lista las imágenes, marca la elegida y elegir una avisa su src', async () => {
    mockApi({ 'GET /api/template-images': () => json(200, { images: [img('tpl-logo-aaaaaaaa.png'), img('tpl-ramen-bbbbbbbb.png', 'ramen')] }) });
    const onPick = vi.fn();
    render(<ImagePicker value="upload:tpl-ramen-bbbbbbbb.png" label="Mis imágenes" onPick={onPick} />);
    const ramen = await screen.findByRole('button', { name: 'Usar ramen' });
    expect(ramen).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Usar logo' }));
    expect(onPick).toHaveBeenCalledWith('upload:tpl-logo-aaaaaaaa.png');
  });

  it('subir una imagen la envía como multipart, la agrega y la elige', async () => {
    const calls = mockApi({
      'GET /api/template-images': () => json(200, { images: [] }),
      'POST /api/template-images': () => json(201, img('tpl-nueva-cccccccc.png', 'nueva')),
    });
    const onPick = vi.fn();
    render(<ImagePicker value="logo" label="Mis imágenes" onPick={onPick} />);
    await screen.findByText(/Todavía no/);
    fireEvent.change(screen.getByLabelText('Subir imagen'), { target: { files: [new File([new Uint8Array([1, 2, 3])], 'nueva.png', { type: 'image/png' })] } });
    await waitFor(() => expect(onPick).toHaveBeenCalledWith('upload:tpl-nueva-cccccccc.png'));
    expect(calls.find((c) => c.key === 'POST /api/template-images')!.init!.body).toBeInstanceOf(FormData);
    expect(await screen.findByRole('button', { name: 'Usar nueva' })).toBeInTheDocument();
  });

  it('una imagen que el servidor rechaza muestra su mensaje y no elige nada', async () => {
    mockApi({
      'GET /api/template-images': () => json(200, { images: [] }),
      'POST /api/template-images': () => json(422, { error: 'invalid_image', message: 'La imagen debe ser PNG, JPG o WEBP.' }),
    });
    const onPick = vi.fn();
    render(<ImagePicker value="logo" label="Mis imágenes" onPick={onPick} />);
    await screen.findByText(/Todavía no/);
    fireEvent.change(screen.getByLabelText('Subir imagen'), { target: { files: [new File(['x'], 'x.png')] } });
    expect(await screen.findByRole('alert')).toHaveTextContent('PNG, JPG o WEBP');
    expect(onPick).not.toHaveBeenCalled();
  });

  it('borrar una imagen sin uso la quita de la lista', async () => {
    mockApi({
      'GET /api/template-images': () => json(200, { images: [img('tpl-logo-aaaaaaaa.png')] }),
      'DELETE /api/template-images/tpl-logo-aaaaaaaa.png': () => json(204),
    });
    render(<ImagePicker value="logo" label="Mis imágenes" onPick={() => undefined} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Borrar logo' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Usar logo' })).toBeNull());
  });

  it('borrar una imagen que usa una plantilla se rechaza y dice cuáles', async () => {
    mockApi({
      'GET /api/template-images': () => json(200, { images: [img('tpl-logo-aaaaaaaa.png')] }),
      'DELETE /api/template-images/tpl-logo-aaaaaaaa.png': () => json(409, { error: 'in_use', message: 'en uso', details: [{ id: 'pop', name: 'Pop crema' }] }),
    });
    render(<ImagePicker value="logo" label="Mis imágenes" onPick={() => undefined} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Borrar logo' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('«Pop crema»');
    expect(screen.getByRole('button', { name: 'Usar logo' })).toBeInTheDocument();
  });

  it('si la lista no carga no rompe el inspector', async () => {
    mockApi({});
    render(<ImagePicker value="logo" label="Mis imágenes" onPick={() => undefined} />);
    expect(await screen.findByText(/Todavía no subiste/)).toBeInTheDocument();
  });
});
