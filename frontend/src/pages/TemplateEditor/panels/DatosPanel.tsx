import { BUSINESS_LIMITS, businessIssues, termsChars } from '../../../../../backend/src/catalog/business-limits';
import type { BusinessSettings } from '../../../../../backend/src/catalog/types';
import type { PanelProps } from './ElementosPanel';

type TextKey = 'storeName' | 'coverTitle' | 'phone1' | 'phone2' | 'address';

const FIELDS: { key: TextKey; label: string; max: number; hint?: string }[] = [
  { key: 'storeName', label: 'Nombre de la tienda', max: BUSINESS_LIMITS.storeName },
  {
    key: 'coverTitle',
    label: 'Texto del banner de portada',
    max: BUSINESS_LIMITS.coverTitle,
    hint: 'Valor por defecto. En Generar catálogo se puede cambiar solo para esa vez.',
  },
  { key: 'phone1', label: 'Teléfono 1', max: BUSINESS_LIMITS.phone },
  { key: 'phone2', label: 'Teléfono 2', max: BUSINESS_LIMITS.phone },
  { key: 'address', label: 'Dirección', max: BUSINESS_LIMITS.address },
];

/**
 * Panel "Datos": los textos del negocio y las políticas de compra. Son únicos para todo el catálogo (no por plantilla)
 * y se guardan con las plantillas. Los límites son los del servidor; pasarse deshabilita Guardar (lo decide `index.tsx`).
 */
export default function DatosPanel({ workspace, actions }: PanelProps) {
  const b: BusinessSettings = workspace.business;
  const issues = businessIssues(b);
  const message = (field: string) => issues.find((i) => i.field === field)?.message;
  const total = termsChars(b.terms);
  const over = total > BUSINESS_LIMITS.termsChars;
  const full = b.terms.length >= BUSINESS_LIMITS.terms;

  const setTerm = (i: number, patch: Partial<BusinessSettings['terms'][number]>, key: string) =>
    actions.patchBusiness({ terms: b.terms.map((t, j) => (j === i ? { ...t, ...patch } : t)) }, key);

  return (
    <div className="ed-panel-body">
      <section>
        <h3 className="ed-panel-title">Textos y contacto</h3>
        {FIELDS.map(({ key, label, max, hint }) => {
          const n = b[key].trim().length;
          const error = message(key);
          return (
            <div key={key} className="ed-field">
              <div className="ed-field-label">
                <span>{label}</span>
                <span className="ed-count" data-testid={`count-${key}`} data-alert={n > max ? 'true' : undefined}>
                  {`${n}/${max}`}
                </span>
              </div>
              <input
                className="ed-text"
                aria-label={label}
                aria-invalid={error ? true : undefined}
                value={b[key]}
                onChange={(e) => actions.patchBusiness({ [key]: e.target.value }, key)}
              />
              {hint && <span className="ed-field-hint">{hint}</span>}
              {error && <span className="ed-field-error">{error}</span>}
            </div>
          );
        })}
      </section>

      <section>
        <h3 className="ed-heading">Políticas de compra</h3>
        {b.terms.map((t, i) => (
          <div key={i} className="ed-term">
            <input
              className="ed-text"
              aria-label="Título de la política"
              value={t.title}
              onChange={(e) => setTerm(i, { title: e.target.value }, `term:${i}:title`)}
            />
            {message(`terms[${i}].title`) && <span className="ed-field-error">{message(`terms[${i}].title`)}</span>}
            <textarea
              aria-label="Texto de la política"
              rows={3}
              value={t.body}
              onChange={(e) => setTerm(i, { body: e.target.value }, `term:${i}:body`)}
            />
            {message(`terms[${i}].body`) && <span className="ed-field-error">{message(`terms[${i}].body`)}</span>}
            <button
              type="button"
              className="ed-link ed-remove"
              aria-label={`Quitar política ${i + 1}`}
              onClick={() => actions.patchBusiness({ terms: b.terms.filter((_, j) => j !== i) })}
            >
              Quitar
            </button>
          </div>
        ))}
        <button
          type="button"
          className="ed-link"
          aria-label="Agregar política"
          disabled={full}
          onClick={() => actions.patchBusiness({ terms: [...b.terms, { title: 'Nueva política', body: '' }] })}
        >
          + Agregar política
        </button>
        {full && <span className="ed-field-hint">Máximo {BUSINESS_LIMITS.terms} políticas.</span>}
        <span className="ed-count ed-terms-count" data-testid="terms-count" data-alert={over ? 'true' : undefined}>
          {`${total} / ${BUSINESS_LIMITS.termsChars} caracteres${over ? ' · no caben en una página' : ''}`}
        </span>
      </section>
    </div>
  );
}
