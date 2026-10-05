import crypto from 'node:crypto';
import { HttpError } from '../api/errors';
import type { PdfQuality } from '../catalog/pdf-quality';

export type JobStatus = 'idle' | 'preparing' | 'rendering' | 'done' | 'failed';

export interface JobState {
  id?: string;
  status: JobStatus;
  step?: string;
  progress?: number;
  error?: string;
  catalogId?: string;
  /** Solo en `done`: la longitud exacta del PDF entregado, en bytes (FR-011). */
  sizeBytes?: number;
  /** Solo en `done`: la calidad con la que se generó; la pantalla la usa para decidir si avisa del tamaño (FR-012). */
  quality?: PdfQuality;
}

/** Un único trabajo a la vez (FR-031). */
export class JobManager {
  private state: JobState = { status: 'idle' };

  current(): JobState {
    return { ...this.state };
  }

  isActive(): boolean {
    return this.state.status === 'preparing' || this.state.status === 'rendering';
  }

  /** Inicia un trabajo; lanza 409 si ya hay uno activo. */
  acquire(status: 'preparing' | 'rendering', step: string): string {
    if (this.isActive()) {
      throw new HttpError(409, 'job_in_progress', 'Ya hay una generación en curso. Espera a que termine.');
    }
    const id = crypto.randomUUID();
    this.state = { id, status, step, progress: 0 };
    return id;
  }

  update(id: string, patch: Partial<Pick<JobState, 'step' | 'progress'>>): void {
    if (this.state.id === id) this.state = { ...this.state, ...patch };
  }

  /** Libera tras preparar (vuelve a reposo). */
  release(id: string): void {
    if (this.state.id === id) this.state = { status: 'idle' };
  }

  complete(id: string, catalogId: string, result: { sizeBytes?: number; quality?: PdfQuality } = {}): void {
    if (this.state.id === id) {
      this.state = {
        id,
        status: 'done',
        step: 'Catálogo listo',
        progress: 100,
        catalogId,
        ...(result.sizeBytes !== undefined ? { sizeBytes: result.sizeBytes } : {}),
        ...(result.quality !== undefined ? { quality: result.quality } : {}),
      };
    }
  }

  fail(id: string, error: string): void {
    if (this.state.id === id) this.state = { id, status: 'failed', step: 'Error', error };
  }
}
