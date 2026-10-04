import type { Db } from '../db/database';
import type { BusinessSettings, Term } from './types';

export type { BusinessSettings };

/** Valores iniciales tomados de `docs/Cat.pdf` (portada y página 38). */
export const DEFAULT_BUSINESS: BusinessSettings = {
  storeName: 'ASIANPOP MARKET+',
  phone1: '310 669 0585',
  phone2: '318 807 0709',
  address: 'Cra 10 # 18-15 centro',
  coverTitle: 'Catálogo de productos',
  terms: [
    {
      title: 'Pedidos y Anticipación',
      body:
        'Todo pedido se realiza con mínimo de 1 día de anticipación.\n' +
        'No manejamos stock inmediato; producimos al momento para garantizar la frescura de tu mochi.',
    },
    {
      title: 'Pagos y Cancelaciones',
      body:
        'Se requiere el 50% del pago para confirmar y agendar tu pedido.\n' +
        'En caso de cancelación, máximo 2 horas después del pago.',
    },
    {
      title: 'Entregas y Envíos',
      body:
        'Contamos con entregas personales en Cra 10 # 18-15 centro (En la tienda pintuco centro) o envío a domicilio con costo adicional.\n' +
        'El cliente dispone de una tolerancia de 10 a 30 minutos para recibir su pedido en el punto acordado.',
    },
    {
      title: 'Conservación (¡Muy Importante!)',
      body:
        'Al contener crema de leche, los mochis deben mantenerse en refrigeración hasta el momento de su consumo.\n' +
        'No nos hacemos responsables por el estado del producto si pasa más de 1 hora fuera del frío.',
    },
  ],
};

interface Row {
  store_name: string;
  phone_1: string;
  phone_2: string;
  address: string;
  cover_title: string;
  terms_json: string;
}

export class BusinessSettingsRepo {
  constructor(private db: Db) {}

  get(): BusinessSettings {
    const row = this.db.prepare('SELECT * FROM business_settings WHERE id = 1').get() as Row | undefined;
    if (!row) {
      this.put(DEFAULT_BUSINESS);
      return structuredClone(DEFAULT_BUSINESS);
    }
    return {
      storeName: row.store_name,
      phone1: row.phone_1,
      phone2: row.phone_2,
      address: row.address,
      coverTitle: row.cover_title,
      terms: JSON.parse(row.terms_json) as Term[],
    };
  }

  put(s: BusinessSettings): BusinessSettings {
    this.db
      .prepare(
        `INSERT INTO business_settings (id, store_name, phone_1, phone_2, address, cover_title, terms_json)
         VALUES (1, @storeName, @phone1, @phone2, @address, @coverTitle, @terms)
         ON CONFLICT(id) DO UPDATE SET store_name=@storeName, phone_1=@phone1, phone_2=@phone2,
           address=@address, cover_title=@coverTitle, terms_json=@terms`,
      )
      .run({ ...s, terms: JSON.stringify(s.terms) });
    return this.get();
  }
}

export class SectionOrderRepo {
  constructor(private db: Db) {}

  get(): string[] {
    return (
      this.db.prepare('SELECT section_key FROM section_order ORDER BY position').all() as {
        section_key: string;
      }[]
    ).map((r) => r.section_key);
  }

  set(keys: string[]): void {
    const unique = [...new Set(keys)];
    this.db.transaction(() => {
      this.db.prepare('DELETE FROM section_order').run();
      const ins = this.db.prepare('INSERT INTO section_order (section_key, position) VALUES (?, ?)');
      unique.forEach((k, i) => ins.run(k, i));
    })();
  }
}
