import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Login from '../src/pages/Login';

const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status });

afterEach(() => vi.unstubAllGlobals());

function fill(user: string, pass: string) {
  fireEvent.change(screen.getByLabelText('Usuario'), { target: { value: user } });
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: pass } });
  fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
}

describe('Login', () => {
  it('muestra un error genérico con credenciales incorrectas y no entra', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(json(401, { error: 'invalid_credentials', message: 'Usuario o contraseña incorrectos.' })),
    );
    const onLoggedIn = vi.fn();
    render(<Login onLoggedIn={onLoggedIn} />);
    fill('x', 'y');
    expect(await screen.findByRole('alert')).toHaveTextContent('Usuario o contraseña incorrectos.');
    expect(onLoggedIn).not.toHaveBeenCalled();
  });

  it('entra con las credenciales correctas', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(204));
    vi.stubGlobal('fetch', fetchMock);
    const onLoggedIn = vi.fn();
    render(<Login onLoggedIn={onLoggedIn} />);
    fill('tienda', 'clave');
    await waitFor(() => expect(onLoggedIn).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/auth/login');
    expect(JSON.parse(init.body)).toEqual({ username: 'tienda', password: 'clave' });
  });

  it('muestra el logo, el título del panel y los campos del diseño Pop', () => {
    render(<Login onLoggedIn={() => {}} />);
    expect(screen.getByAltText('ASIANPOP MARKET')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Generador de catálogo' })).toBeInTheDocument();
    expect(screen.getByText('Panel de administración · ASIANPOP MARKET+')).toBeInTheDocument();
    expect(screen.getByLabelText('Usuario')).toBeInTheDocument();
  });

  it('el error no revela cuál dato falló y el botón se bloquea mientras entra', async () => {
    let release: (r: Response) => void = () => {};
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((r) => (release = r))));
    render(<Login onLoggedIn={() => {}} />);
    fill('tienda', 'mala');
    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeDisabled();
    release(json(401, { error: 'invalid_credentials', message: 'Usuario o contraseña incorrectos.' }));
    const alert = await screen.findByRole('alert');
    expect(alert).not.toHaveTextContent(/solo el usuario|solo la contraseña/i);
    expect(alert).toHaveTextContent('Usuario o contraseña incorrectos.');
    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeEnabled();
  });

  it('el campo de contraseña oculta lo escrito', () => {
    render(<Login onLoggedIn={() => {}} />);
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('type', 'password');
  });
});
