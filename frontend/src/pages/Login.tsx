import { useState, type FormEvent } from 'react';
import logo from '../assets/logo.jpg';
import { Alert, Button, Field } from '../components/ui';
import { api, ApiError } from '../services/api';

export default function Login({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post('/api/auth/login', { username, password });
      onLoggedIn();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo iniciar sesión.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen grid place-items-center bg-pop-bg px-5 py-10">
      <form
        onSubmit={submit}
        className="w-full max-w-[400px] flex flex-col gap-6 p-10 rounded-pop-lg bg-pop-surface border border-pop-line shadow-pop-card"
        aria-labelledby="login-title"
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <img src={logo} alt="ASIANPOP MARKET" className="w-24 h-24 rounded-full object-cover" />
          <h1 id="login-title" className="text-2xl font-semibold">
            Generador de catálogo
          </h1>
          <p className="text-pop-muted">Panel de administración · ASIANPOP MARKET+</p>
        </div>
        <div className="flex flex-col gap-3.5">
          <Field
            label="Usuario"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoFocus
          />
          <Field
            label="Contraseña"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        {error && <Alert tone="error">{error}</Alert>}
        <Button type="submit" disabled={busy} className="h-[46px]">
          Ingresar
        </Button>
      </form>
    </main>
  );
}
