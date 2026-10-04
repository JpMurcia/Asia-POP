import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { componentsTotal, computeBundlePrice } from '../../../backend/src/catalog/bundle-pricing';
import { Alert, Badge, Button, Card, Field, PageHeader } from '../components/ui';
import { notifySummaryChanged } from '../hooks/usePanelSummary';
import { api, ApiError } from '../services/api';

interface Section {
  id: string;
  name: string;
}
interface Opt {
  id: string;
  name: string;
  price: number;
  /** Agotado en Alegra (un producto propio nunca lo está). */
  soldOut?: boolean;
}
interface Options {
  alegra: Opt[];
  custom: Opt[];
  alegraAvailable: boolean;
}
interface Component {
  source: 'alegra' | 'custom';
  productId: string;
  quantity: number;
  name?: string;
  soldOut?: boolean;
}
interface Bundle {
  id: string;
  sectionId: string;
  name: string;
  description: string;
  imageUrl: string | null;
  pricing: { type: 'fixed'; price: number } | { type: 'discount'; percent: number };
  components: Component[];
  computedPrice: number | null;
}

const cop = (n: number) => `$${n.toLocaleString('es-CO')}`;
const selectCls = 'h-10 px-2.5 rounded-pop border border-pop-line bg-pop-input';

const emptyForm = {
  name: '',
  description: '',
  pricingType: 'discount' as 'fixed' | 'discount',
  value: '10',
  components: [] as Component[],
};

export default function Bundles() {
  const [sections, setSections] = useState<Section[]>([]);
  const [sectionId, setSectionId] = useState('');
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [options, setOptions] = useState<Options>({ alegra: [], custom: [], alegraAvailable: true });
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const [s, b, o] = await Promise.all([
      api.get<Section[]>('/api/sections/custom'),
      api.get<Bundle[]>('/api/bundles'),
      api.get<Options>('/api/bundles/component-options'),
    ]);
    setSections(s);
    setSectionId((cur) => cur || s[0]?.id || '');
    setBundles(b);
    setOptions(o);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const reset = () => {
    setForm(emptyForm);
    setEditingId(null);
    setFile(null);
  };

  function edit(b: Bundle) {
    setEditingId(b.id);
    setSectionId(b.sectionId);
    setFile(null);
    setForm({
      name: b.name,
      description: b.description,
      pricingType: b.pricing.type,
      value: String(b.pricing.type === 'fixed' ? b.pricing.price : b.pricing.percent),
      components: b.components.map((c) => ({ source: c.source, productId: c.productId, quantity: c.quantity })),
    });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    const body = {
      sectionId,
      name: form.name,
      description: form.description,
      pricing:
        form.pricingType === 'fixed'
          ? { type: 'fixed', price: Number(form.value) }
          : { type: 'discount', percent: Number(form.value) },
      components: form.components.map((c) => ({ source: c.source, productId: c.productId, quantity: c.quantity })),
    };
    try {
      const saved = editingId
        ? await api.put<Bundle>(`/api/bundles/${editingId}`, body)
        : await api.post<Bundle>('/api/bundles', body);
      if (file) {
        const fd = new FormData();
        fd.append('image', file);
        await api.upload(`/api/bundles/${saved.id}/image`, fd);
      }
      reset();
      await load();
      notifySummaryChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar el combo.');
    }
  }

  async function remove(b: Bundle) {
    if (!confirm(`¿Eliminar el combo ${b.name}?`)) return;
    await api.del(`/api/bundles/${b.id}`);
    await load();
    notifySummaryChanged();
  }

  const setComp = (i: number, patch: Partial<Component>) =>
    setForm({ ...form, components: form.components.map((c, j) => (j === i ? { ...c, ...patch } : c)) });

  const optionsFor = (source: 'alegra' | 'custom') => (source === 'alegra' ? options.alegra : options.custom);

  // Desglose mientras se edita (FR-032): con las mismas reglas del servidor (`bundle-pricing.ts`). Un producto aún sin
  // elegir no suma; un valor vacío o inválido se trata como "sin descuento" en vez de romper el cálculo.
  const priced = form.components
    .filter((c) => c.productId !== '')
    .map((c) => ({
      unitPrice: optionsFor(c.source).find((o) => o.id === c.productId)?.price ?? 0,
      quantity: Number.isFinite(c.quantity) ? Math.max(0, c.quantity) : 0,
    }));
  const sum = componentsTotal(priced);
  const typed = Number(form.value);
  const validValue = form.value.trim() !== '' && Number.isFinite(typed) && typed >= 0;
  const final = !validValue
    ? sum
    : computeBundlePrice(
        form.pricingType === 'fixed' ? { type: 'fixed', price: typed } : { type: 'discount', percent: Math.min(typed, 100) },
        priced,
      );
  const saving = Math.max(0, sum - final);

  // «Combo no disponible» (mockup): los componentes de Alegra elegidos que están agotados
  const soldOutNames = [
    ...new Set(
      form.components
        .filter((c) => c.source === 'alegra' && c.productId !== '')
        .map((c) => options.alegra.find((o) => o.id === c.productId))
        .filter((o): o is Opt => !!o?.soldOut)
        .map((o) => o.name),
    ),
  ];

  if (sections.length === 0) {
    return (
      <section className="flex flex-col gap-3">
        <PageHeader title="Combos" />
        <p className="text-sm text-pop-muted">
          Primero crea una sección propia (por ejemplo REGALOS) en «Contenido propio».
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-5 max-w-3xl">
      <PageHeader title="Combos" subtitle="Regalos armados con productos de Alegra o propios, con precio fijo o descuento." />
      {!options.alegraAvailable && (
        <Alert tone="warning">
          No se pudo consultar Alegra: los productos de Alegra no están disponibles para armar combos ahora.
        </Alert>
      )}
      {error && <Alert tone="error">{error}</Alert>}

      <Card className="!p-0">
        <ul className="list-none m-0 p-0">
          {bundles.map((b, idx) => (
            <li key={b.id} className={`p-3 flex items-center gap-3 ${idx % 2 ? 'bg-pop-surface2' : ''}`}>
              {b.imageUrl ? (
                <img src={b.imageUrl} alt="" className="w-12 h-16 object-cover rounded-lg" />
              ) : (
                <span className="w-12 h-16 grid place-items-center text-[10px] text-center bg-pop-warn-bg border border-pop-amber rounded-lg">
                  sin imagen
                </span>
              )}
              <div className="flex-1 text-sm">
                <div className="font-bold flex items-center gap-2 flex-wrap">
                  {b.name} · {b.computedPrice != null ? cop(b.computedPrice) : 'precio no disponible'}{' '}
                  <Badge tone="neutral">
                    {b.pricing.type === 'fixed' ? 'precio fijo' : `${b.pricing.percent}% de descuento`}
                  </Badge>
                </div>
                <div className="text-pop-muted">
                  {b.components.map((c) => `${c.quantity} × ${c.name}${c.soldOut ? ' (agotado)' : ''}`).join(' + ')}
                </div>
                {b.components.some((c) => c.soldOut) && (
                  <div className="text-xs font-bold text-pop-err-text">No disponible</div>
                )}
                {!b.imageUrl && (
                  <div className="text-xs text-pop-warn-text">No saldrá en el catálogo hasta que tenga imagen.</div>
                )}
              </div>
              <Button variant="secondary" className="h-9" onClick={() => edit(b)}>
                Editar
              </Button>
              <Button variant="danger" className="h-9" onClick={() => remove(b)}>
                Eliminar
              </Button>
            </li>
          ))}
          {bundles.length === 0 && <li className="p-4 text-sm text-pop-muted">Aún no hay combos.</li>}
        </ul>
      </Card>

      <Card>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">{editingId ? 'Editar combo' : 'Nuevo combo'}</h2>
          <label className="flex items-center gap-2 text-[13px] font-semibold">
            Sección
            <select className={selectCls} value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <Field label="Nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="bundle-desc" className="font-semibold text-[13px]">
              Descripción
            </label>
            <textarea
              id="bundle-desc"
              className="px-3.5 py-2 rounded-pop border border-pop-line bg-pop-input"
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-[13px] font-semibold mb-1">Productos del combo</legend>
            {form.components.map((c, i) => (
              <div key={i} className="flex gap-2 flex-wrap items-center">
                <select aria-label="Origen" className={selectCls} value={c.source} onChange={(e) => setComp(i, { source: e.target.value as 'alegra' | 'custom', productId: '' })}>
                  <option value="alegra">Alegra</option>
                  <option value="custom">Propio</option>
                </select>
                <select aria-label="Producto" className={`${selectCls} flex-1 min-w-40`} value={c.productId} onChange={(e) => setComp(i, { productId: e.target.value })} required>
                  <option value="">— Elige un producto —</option>
                  {optionsFor(c.source).map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name} ({cop(o.price)})
                    </option>
                  ))}
                </select>
                <input aria-label="Cantidad" type="number" min={1} className={`${selectCls} w-20`} value={c.quantity} onChange={(e) => setComp(i, { quantity: Number(e.target.value) })} />
                <Button variant="danger" className="h-10" onClick={() => setForm({ ...form, components: form.components.filter((_, j) => j !== i) })}>
                  Quitar
                </Button>
              </div>
            ))}
            <Button
              variant="secondary"
              className="self-start h-9"
              onClick={() => setForm({ ...form, components: [...form.components, { source: 'alegra', productId: '', quantity: 1 }] })}
            >
              + Agregar producto
            </Button>
          </fieldset>

          <fieldset className="flex gap-4 items-center flex-wrap">
            <legend className="text-[13px] font-semibold mb-1">Precio</legend>
            <label className="text-sm flex items-center gap-1.5">
              <input type="radio" name="pricing" checked={form.pricingType === 'discount'} onChange={() => setForm({ ...form, pricingType: 'discount', value: '10' })} /> Descuento %
            </label>
            <label className="text-sm flex items-center gap-1.5">
              <input type="radio" name="pricing" checked={form.pricingType === 'fixed'} onChange={() => setForm({ ...form, pricingType: 'fixed', value: '' })} /> Precio fijo
            </label>
            <input aria-label="Valor del precio" inputMode="numeric" className={`${selectCls} w-32`} value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} required />
          </fieldset>

          <div data-testid="bundle-summary" className="flex flex-col gap-1 p-4 rounded-pop bg-pop-surface2">
            <div className="flex justify-between text-[13px] text-pop-muted">
              <span>Suma de componentes</span>
              <span data-testid="bundle-sum">{cop(sum)}</span>
            </div>
            <div className="flex justify-between text-[13px] text-pop-muted">
              <span>Ahorro</span>
              <span data-testid="bundle-saving">{cop(saving)}</span>
            </div>
            <div className="flex justify-between items-baseline pt-1.5">
              <span className="font-bold">Precio en catálogo</span>
              <span data-testid="bundle-final" className="font-display text-[26px] font-semibold">
                {cop(final)}
              </span>
            </div>
          </div>

          {soldOutNames.length > 0 && (
            <Alert tone="error" data-testid="bundle-unavailable">
              <strong>Combo no disponible.</strong> {soldOutNames.join(', ')}{' '}
              {soldOutNames.length === 1 ? 'está agotado' : 'están agotados'} en Alegra; el combo saldrá con badge AGOTADO (al
              generar puedes omitirlo).
            </Alert>
          )}

          <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
            Imagen (obligatoria para que salga en el catálogo)
            <input type="file" accept="image/png,image/jpeg,image/webp" className="font-normal" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          <div className="flex gap-3">
            <Button type="submit">{editingId ? 'Guardar cambios' : 'Crear combo'}</Button>
            {editingId && (
              <Button variant="secondary" onClick={reset}>
                Cancelar
              </Button>
            )}
          </div>
        </form>
      </Card>
    </section>
  );
}
