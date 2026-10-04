import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Alert, Button, Card, Field } from '../components/ui';
import { notifySummaryChanged } from '../hooks/usePanelSummary';
import { api, ApiError } from '../services/api';

interface CustomSection {
  id: string;
  name: string;
}
interface Option {
  label: string;
  price: string;
  maxFlavors: string;
}
interface Product {
  id: string;
  sectionId: string;
  name: string;
  description: string;
  price: number | null;
  flavors: string[];
  options: { label: string; price: number; maxFlavors: number | null }[];
  imageUrl: string | null;
}

const emptyForm = { name: '', description: '', price: '', flavors: '', options: [] as Option[] };
const inputCls = 'h-10 px-2.5 rounded-pop border border-pop-line bg-pop-input';

/** Productos propios (mochis, regalos...). Se muestra como la pestaña "Productos propios" de Contenido propio. */
export default function CustomProducts() {
  const [sections, setSections] = useState<CustomSection[]>([]);
  const [sectionId, setSectionId] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<CustomSection[]>('/api/sections/custom').then((s) => {
      setSections(s);
      setSectionId((cur) => cur || s[0]?.id || '');
    });
  }, []);

  const loadProducts = useCallback(async () => {
    if (sectionId) setProducts(await api.get<Product[]>(`/api/custom-products?sectionId=${sectionId}`));
    else setProducts([]);
  }, [sectionId]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  const reset = () => {
    setForm(emptyForm);
    setEditingId(null);
    setFile(null);
  };

  function edit(p: Product) {
    setEditingId(p.id);
    setFile(null);
    setForm({
      name: p.name,
      description: p.description,
      price: p.price != null ? String(p.price) : '',
      flavors: p.flavors.join(', '),
      options: p.options.map((o) => ({ label: o.label, price: String(o.price), maxFlavors: o.maxFlavors ? String(o.maxFlavors) : '' })),
    });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    const body = {
      sectionId,
      name: form.name,
      description: form.description,
      price: form.price.trim() ? Number(form.price) : null,
      flavors: form.flavors.split(',').map((f) => f.trim()).filter(Boolean),
      options: form.options.map((o) => ({
        label: o.label,
        price: Number(o.price),
        maxFlavors: o.maxFlavors.trim() ? Number(o.maxFlavors) : null,
      })),
    };
    try {
      const saved = editingId
        ? await api.put<Product>(`/api/custom-products/${editingId}`, body)
        : await api.post<Product>('/api/custom-products', body);
      if (file) {
        const fd = new FormData();
        fd.append('image', file);
        await api.upload(`/api/custom-products/${saved.id}/image`, fd);
      }
      reset();
      await loadProducts();
      notifySummaryChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar el producto.');
    }
  }

  async function remove(p: Product) {
    if (!confirm(`¿Eliminar ${p.name}?`)) return;
    setError('');
    try {
      await api.del(`/api/custom-products/${p.id}`);
      await loadProducts();
      notifySummaryChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo eliminar.');
    }
  }

  if (sections.length === 0) {
    return (
      <p className="text-pop-muted text-sm">
        Primero crea una sección propia en la pestaña «Secciones» (por ejemplo MOCHIS).
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5 max-w-3xl">
      <label className="flex items-center gap-2 text-sm font-semibold">
        Sección
        <select
          className={inputCls}
          value={sectionId}
          onChange={(e) => {
            setSectionId(e.target.value);
            reset();
          }}
        >
          {sections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>

      {error && <Alert tone="error">{error}</Alert>}

      <Card className="!p-0">
        <ul className="list-none m-0 p-0">
          {products.map((p, idx) => (
            <li key={p.id} className={`p-3 flex items-center gap-3 ${idx % 2 ? 'bg-pop-surface2' : ''}`}>
              {p.imageUrl ? (
                <img src={p.imageUrl} alt="" className="w-12 h-16 object-cover rounded-lg" />
              ) : (
                <span className="w-12 h-16 grid place-items-center text-[10px] text-center bg-pop-warn-bg border border-pop-amber rounded-lg">
                  sin imagen
                </span>
              )}
              <div className="flex-1 text-sm">
                <div className="font-bold">{p.name}</div>
                <div className="text-pop-muted">
                  {p.price != null && `$${p.price.toLocaleString('es-CO')} `}
                  {p.options.map((o) => `${o.label}: $${o.price.toLocaleString('es-CO')}`).join(' · ')}
                </div>
                {!p.imageUrl && (
                  <div className="text-xs text-pop-warn-text">No saldrá en el catálogo hasta que tenga imagen.</div>
                )}
              </div>
              <Button variant="secondary" className="h-9" onClick={() => edit(p)}>
                Editar
              </Button>
              <Button variant="danger" className="h-9" onClick={() => remove(p)}>
                Eliminar
              </Button>
            </li>
          ))}
          {products.length === 0 && <li className="p-4 text-sm text-pop-muted">Esta sección aún no tiene productos.</li>}
        </ul>
      </Card>

      <Card>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">{editingId ? 'Editar producto' : 'Nuevo producto'}</h2>
          <Field label="Nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="cp-desc" className="font-semibold text-[13px]">
              Descripción
            </label>
            <textarea
              id="cp-desc"
              className="px-3.5 py-2 rounded-pop border border-pop-line bg-pop-input"
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <Field
            label="Precio (COP, opcional si hay opciones)"
            inputMode="numeric"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
          />
          <fieldset className="flex flex-col gap-2">
            <legend className="text-[13px] font-semibold mb-1">Opciones con precio (por ejemplo «Caja x 6 UND»)</legend>
            {form.options.map((o, i) => (
              <div key={i} className="flex gap-2 flex-wrap">
                <input aria-label="Etiqueta de la opción" placeholder="Caja x 6 UND" className={`${inputCls} flex-1 min-w-32`} value={o.label} onChange={(e) => setForm({ ...form, options: form.options.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} required />
                <input aria-label="Precio de la opción" placeholder="30000" inputMode="numeric" className={`${inputCls} w-28`} value={o.price} onChange={(e) => setForm({ ...form, options: form.options.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)) })} required />
                <input aria-label="Máximo de sabores" placeholder="Máx. sabores" inputMode="numeric" className={`${inputCls} w-28`} value={o.maxFlavors} onChange={(e) => setForm({ ...form, options: form.options.map((x, j) => (j === i ? { ...x, maxFlavors: e.target.value } : x)) })} />
                <Button variant="danger" className="h-10" onClick={() => setForm({ ...form, options: form.options.filter((_, j) => j !== i) })}>
                  Quitar
                </Button>
              </div>
            ))}
            <Button
              variant="secondary"
              className="self-start h-9"
              onClick={() => setForm({ ...form, options: [...form.options, { label: '', price: '', maxFlavors: '' }] })}
            >
              + Agregar opción
            </Button>
          </fieldset>
          <Field
            label="Sabores (separados por coma)"
            value={form.flavors}
            onChange={(e) => setForm({ ...form, flavors: e.target.value })}
            placeholder="FRESA, ARANDANO, MANGO"
          />
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
            Imagen (PNG, JPG o WEBP, máx. 5 MB) — obligatoria para que salga en el catálogo
            <input type="file" accept="image/png,image/jpeg,image/webp" className="font-normal" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          <div className="flex gap-3">
            <Button type="submit">{editingId ? 'Guardar cambios' : 'Crear producto'}</Button>
            {editingId && (
              <Button variant="secondary" onClick={reset}>
                Cancelar
              </Button>
            )}
          </div>
        </form>
      </Card>
    </div>
  );
}
