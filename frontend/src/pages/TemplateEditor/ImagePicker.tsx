import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../../services/api';

/** Una imagen subida por la persona responsable (feature 010): lo que devuelve `/api/template-images`. */
export interface UploadedImage {
  file: string;
  name: string;
  bytes: number;
  width: number;
  height: number;
  src: string;
}

interface Props {
  /** El `src` actual del elemento: una clave fija o `upload:<archivo>`. */
  value: unknown;
  label: string;
  onPick: (src: string) => void;
}

/**
 * «Mis imágenes»: las imágenes que la persona subió (logo, ilustraciones). Elegir una la pone en el elemento; subir una
 * nueva la guarda y la elige; borrar una que usa alguna plantilla se rechaza y se dice cuáles la usan.
 */
export default function ImagePicker({ value, label, onPick }: Props) {
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      setImages((await api.get<{ images: UploadedImage[] }>('/api/template-images')).images);
    } catch {
      setImages([]);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setMessage('');
    try {
      const form = new FormData();
      form.append('image', file);
      const created = await api.postForm<UploadedImage>('/api/template-images', form);
      setImages((cur) => [...cur, created]);
      onPick(created.src);
    } catch (e) {
      setMessage(e instanceof ApiError ? e.message : 'No se pudo subir la imagen.');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  async function remove(image: UploadedImage) {
    setMessage('');
    try {
      await api.del(`/api/template-images/${image.file}`);
      setImages((cur) => cur.filter((i) => i.file !== image.file));
    } catch (e) {
      if (e instanceof ApiError && e.code === 'in_use') {
        const names = ((e.details as { name: string }[] | undefined) ?? []).map((t) => `«${t.name}»`).join(', ');
        setMessage(`No se puede borrar: la usa ${names}. Quítala de ahí primero.`);
      } else {
        setMessage(e instanceof ApiError ? e.message : 'No se pudo borrar la imagen.');
      }
    }
  }

  return (
    <div className="ed-field" role="group" aria-label={label} data-testid="image-picker">
      <div className="ed-field-label">
        <span>{label}</span>
      </div>
      {images.length === 0 ? (
        <span className="ed-field-hint">Todavía no subiste imágenes (PNG, JPG o WEBP, hasta 5 MB).</span>
      ) : (
        <ul className="ed-uploads">
          {images.map((i) => (
            <li key={i.file} className="ed-upload" data-selected={value === i.src}>
              <button
                type="button"
                className="ed-upload-pick"
                aria-pressed={value === i.src}
                aria-label={`Usar ${i.name}`}
                onClick={() => onPick(i.src)}
              >
                <img src={`/media/uploads/${i.file}`} alt="" />
                <span>{i.name}</span>
              </button>
              <button type="button" className="ed-upload-del" aria-label={`Borrar ${i.name}`} onClick={() => void remove(i)}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="ed-upload-input"
        aria-label="Subir imagen"
        disabled={busy}
        onChange={(e) => void upload(e.target.files?.[0])}
      />
      {message && (
        <p role="alert" className="ed-limit-note">
          {message}
        </p>
      )}
    </div>
  );
}
