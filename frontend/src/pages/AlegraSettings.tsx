import { useEffect, useState, type FormEvent } from 'react';
import { Alert, Button, Card, Field, PageHeader } from '../components/ui';
import { notifySummaryChanged } from '../hooks/usePanelSummary';
import { api, ApiError } from '../services/api';

interface Attempts {
  limit: number;
  remaining: number;
}

interface Status {
  email: string | null;
  isConfigured: boolean;
  lastTestedAt: string | null;
  /** Solo lo informan `GET` y las pruebas; el `PUT` no. */
  testAttempts?: Attempts;
}

/** Los intentos de prueba que informa el servidor en una respuesta de error (`details.testAttempts`). */
function attemptsIn(details: unknown): Attempts | undefined {
  const a = (details as { testAttempts?: Partial<Attempts> } | null | undefined)?.testAttempts;
  return typeof a?.limit === 'number' && typeof a.remaining === 'number' ? { limit: a.limit, remaining: a.remaining } : undefined;
}

export default function AlegraSettings() {
  const [status, setStatus] = useState<Status | null>(null);
  const [attempts, setAttempts] = useState<Attempts | null>(null);
  const [email, setEmail] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get<Status>('/api/settings/alegra').then((s) => {
      setStatus(s);
      if (s.testAttempts) setAttempts(s.testAttempts);
      if (s.email) setEmail(s.email);
    });
  }, []);

  async function run(action: 'test' | 'save', e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      if (action === 'test') {
        const res = await api.post<{ ok: boolean; testAttempts?: Attempts }>('/api/settings/alegra/test', { email, apiToken });
        if (res?.testAttempts) setAttempts(res.testAttempts);
        setMessage({ type: 'ok', text: 'Conexión exitosa con Alegra.' });
      } else {
        const s = await api.put<Status>('/api/settings/alegra', { email, apiToken });
        setStatus(s);
        setApiToken(''); // el token no se conserva en pantalla
        setMessage({ type: 'ok', text: 'Credenciales guardadas y conexión verificada.' });
        notifySummaryChanged();
      }
    } catch (err) {
      const left = err instanceof ApiError ? attemptsIn(err.details) : undefined;
      if (left) setAttempts(left);
      setMessage({ type: 'error', text: err instanceof ApiError ? err.message : 'Error inesperado.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-5 max-w-lg">
      <PageHeader title="Conexión Alegra" subtitle="Credenciales para leer tus productos. El token nunca se muestra." />
      {status && (
        <p className="text-sm text-pop-muted" data-testid="alegra-status">
          {status.isConfigured
            ? `Conectado como ${status.email}. Última verificación: ${
                status.lastTestedAt ? new Date(status.lastTestedAt).toLocaleString('es-CO') : '—'
              }.`
            : 'Aún no hay credenciales guardadas.'}
        </p>
      )}
      <Card>
        <form className="flex flex-col gap-4" onSubmit={(e) => run('save', e)}>
          <Field
            label="Correo de Alegra"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Field
            label="Token de la API"
            type="password"
            value={apiToken}
            onChange={(e) => setApiToken(e.target.value)}
            autoComplete="off"
            placeholder={status?.isConfigured ? 'Ingresa un token nuevo para reemplazarlo' : ''}
            required
          />
          {message && <Alert tone={message.type === 'error' ? 'error' : 'success'}>{message.text}</Alert>}
          <div className="flex gap-3 items-center flex-wrap">
            <Button variant="secondary" disabled={busy} onClick={(e) => run('test', e)}>
              Probar conexión
            </Button>
            <Button type="submit" disabled={busy}>
              Guardar
            </Button>
            {attempts && (
              <span className="ml-auto text-xs text-pop-muted" data-testid="test-attempts">
                Intentos de prueba: {attempts.remaining}/{attempts.limit} por minuto
              </span>
            )}
          </div>
          {attempts && attempts.remaining <= 0 && (
            <p className="text-[13px] text-pop-err-text">Espera un minuto antes de volver a probar.</p>
          )}
        </form>
      </Card>
    </section>
  );
}
