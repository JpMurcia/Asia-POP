import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loggedInAgent, testConfig, testContext } from '../helpers';
import { startAlegraMock, type AlegraMock } from '../fixtures/alegra-mock';

let mock: AlegraMock | undefined;
afterEach(async () => mock?.close());

// 1x1 PNG válido
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

async function setup() {
  return loggedInAgent(testContext());
}

async function newSection(agent: Awaited<ReturnType<typeof setup>>['agent'], name = 'MOCHIS') {
  return (await agent.post('/api/sections/custom').send({ name, introText: '¿Qué es el mochi?' }).expect(201)).body;
}

describe('secciones propias', () => {
  it('crea, lista, edita y elimina; el nombre es único', async () => {
    const { agent } = await setup();
    const s = await newSection(agent);
    expect(s).toMatchObject({ name: 'MOCHIS', introText: '¿Qué es el mochi?' });
    const dup = await agent.post('/api/sections/custom').send({ name: 'MOCHIS' });
    expect(dup.status).toBe(409);
    expect(dup.body.error).toBe('duplicate_name');
    await agent.put(`/api/sections/custom/${s.id}`).send({ name: 'MOCHIS ARTESANALES' }).expect(200);
    expect((await agent.get('/api/sections/custom')).body[0].name).toBe('MOCHIS ARTESANALES');
    await agent.delete(`/api/sections/custom/${s.id}`).expect(204);
    expect((await agent.get('/api/sections/custom')).body).toEqual([]);
    await agent.delete(`/api/sections/custom/${s.id}`).expect(404);
  });

  it('valida el nombre (422)', async () => {
    const { agent } = await setup();
    await agent.post('/api/sections/custom').send({ name: '   ' }).expect(422);
  });

  it('las secciones propias aparecen en /sections y se pueden ordenar', async () => {
    const { agent } = await setup();
    const a = await newSection(agent, 'MOCHIS');
    const b = await newSection(agent, 'REGALOS');
    await agent.put('/api/sections/order').send({ keys: [`custom:${b.id}`, `custom:${a.id}`] }).expect(204);
    const list = (await agent.get('/api/sections').expect(200)).body;
    expect(list.map((s: { name: string }) => s.name)).toEqual(['REGALOS', 'MOCHIS']);
  });
});

describe('productos propios', () => {
  it('CRUD con opciones y sabores', async () => {
    const { agent } = await setup();
    const s = await newSection(agent);
    const created = await agent
      .post('/api/custom-products')
      .send({
        sectionId: s.id,
        name: 'Caja de mochis',
        description: 'Rellenos',
        options: [
          { label: 'Caja x 6 UND', price: 30000, maxFlavors: 2 },
          { label: 'Caja x 12 UND', price: 50000, maxFlavors: 4 },
        ],
        flavors: ['FRESA', 'MANGO'],
      })
      .expect(201);
    expect(created.body.options).toHaveLength(2);
    expect(created.body.flavors).toEqual(['FRESA', 'MANGO']);
    expect(created.body.imageUrl).toBeNull();

    const upd = await agent
      .put(`/api/custom-products/${created.body.id}`)
      .send({ sectionId: s.id, name: 'Caja grande', price: 9000 })
      .expect(200);
    expect(upd.body).toMatchObject({ name: 'Caja grande', price: 9000, options: [], flavors: [] });

    const list = await agent.get(`/api/custom-products?sectionId=${s.id}`).expect(200);
    expect(list.body).toHaveLength(1);
    await agent.delete(`/api/custom-products/${created.body.id}`).expect(204);
    await agent.delete(`/api/custom-products/${created.body.id}`).expect(404);
  });

  it('exige precio u opciones y una sección existente', async () => {
    const { agent } = await setup();
    const s = await newSection(agent);
    const noPrice = await agent.post('/api/custom-products').send({ sectionId: s.id, name: 'x' });
    expect(noPrice.status).toBe(422);
    const badSection = await agent.post('/api/custom-products').send({ sectionId: 'nope', name: 'x', price: 1 });
    expect(badSection.status).toBe(422);
    expect(badSection.body.error).toBe('invalid_section');
  });

  it('carga una imagen válida, la sirve y reemplaza la anterior', async () => {
    const { agent, ctx } = await setup();
    const s = await newSection(agent);
    const p = (await agent.post('/api/custom-products').send({ sectionId: s.id, name: 'Mochi', price: 8000 })).body;
    const up = await agent.put(`/api/custom-products/${p.id}/image`).attach('image', PNG, 'a.png').expect(200);
    expect(up.body.imagePath).toMatch(/^\/media\/uploads\/[\w-]+\.png$/);
    await agent.get(up.body.imagePath).expect(200);
    const first = path.join(ctx.uploadsDir, path.basename(up.body.imagePath));
    expect(fs.existsSync(first)).toBe(true);

    const up2 = await agent.put(`/api/custom-products/${p.id}/image`).attach('image', PNG, 'b.png').expect(200);
    expect(up2.body.imagePath).not.toBe(up.body.imagePath);
    expect(fs.existsSync(first)).toBe(false); // la anterior se borró
  });

  it('rechaza archivos que no son imagen (aunque tengan extensión .png) y los demasiado grandes', async () => {
    const { agent } = await setup();
    const s = await newSection(agent);
    const p = (await agent.post('/api/custom-products').send({ sectionId: s.id, name: 'Mochi', price: 8000 })).body;
    const fake = await agent
      .put(`/api/custom-products/${p.id}/image`)
      .attach('image', Buffer.from('<?php echo 1; ?>'), 'x.png');
    expect(fake.status).toBe(422);
    expect(fake.body.error).toBe('invalid_image');

    const big = Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024 + 10)]);
    const tooBig = await agent.put(`/api/custom-products/${p.id}/image`).attach('image', big, 'big.png');
    expect(tooBig.status).toBe(413);
    expect(tooBig.body.error).toBe('image_too_large');

    const none = await agent.put(`/api/custom-products/${p.id}/image`).send({});
    expect(none.status).toBe(422);
  });

  it('eliminar la sección elimina sus productos y la imagen', async () => {
    const { agent, ctx } = await setup();
    const s = await newSection(agent);
    const p = (await agent.post('/api/custom-products').send({ sectionId: s.id, name: 'Mochi', price: 8000 })).body;
    const up = await agent.put(`/api/custom-products/${p.id}/image`).attach('image', PNG, 'a.png');
    const file = path.join(ctx.uploadsDir, path.basename(up.body.imagePath));
    await agent.delete(`/api/sections/custom/${s.id}`).expect(204);
    expect((await agent.get('/api/custom-products')).body).toEqual([]);
    expect(fs.existsSync(file)).toBe(false);
  });
});

describe('catálogo con sección propia', () => {
  it('el producto propio con imagen sale en el catálogo, sin sello; el que no tiene imagen se omite', async () => {
    mock = await startAlegraMock({ categories: [{ id: 'c1', name: 'RAMEN' }] });
    mock.setItems([
      {
        id: '1',
        name: 'Shin',
        status: 'active',
        price: 9000,
        category: { id: 'c1', name: 'RAMEN' },
        images: [`${mock.url}/img/ok.png`],
      },
    ]);
    const { agent } = await loggedInAgent(testContext({ config: testConfig({ alegraBaseUrl: mock.url }) }));
    await agent.put('/api/settings/alegra').send({ email: 'tienda@example.com', apiToken: 'tok_valido' }).expect(200);

    const s = await newSection(agent);
    const mk = async (name: string, withImage: boolean) => {
      const p = (
        await agent.post('/api/custom-products').send({
          sectionId: s.id,
          name,
          options: [{ label: 'Caja x 6 UND', price: 30000, maxFlavors: 2 }],
          flavors: ['FRESA'],
        })
      ).body;
      if (withImage) await agent.put(`/api/custom-products/${p.id}/image`).attach('image', PNG, 'a.png');
      return p;
    };
    await mk('Mochi con imagen', true);
    await mk('Mochi sin imagen', false);

    const { body: prep } = await agent.post('/api/catalog/prepare').send({}).expect(200);
    expect(prep.report.counts).toMatchObject({ included: 2, omitted: 1, soldOut: 0 });
    expect(prep.report.omittedNoImage).toEqual([
      expect.objectContaining({ source: 'custom', name: 'Mochi sin imagen' }),
    ]);
    const payload = (await agent.get(`/api/catalog/payload/${prep.prepareId}`)).body;
    const mochis = payload.sections.find((x: { name: string }) => x.name === 'MOCHIS');
    expect(mochis.source).toBe('custom');
    expect(mochis.pages[0][0]).toMatchObject({ kind: 'custom', name: 'Mochi con imagen' });
    expect(mochis.pages[0][0].options[0].priceLabel).toBe('$30.000');
    expect(mochis.pages[0][0]).not.toHaveProperty('soldOut');
  });
});

describe('configuración del negocio', () => {
  it('trae los valores de Cat.pdf por defecto y permite editarlos', async () => {
    const { agent } = await setup();
    const g = (await agent.get('/api/settings/business').expect(200)).body;
    expect(g).toMatchObject({ storeName: 'ASIANPOP MARKET+', phone1: '310 669 0585', phone2: '318 807 0709' });
    expect(g.terms.length).toBeGreaterThan(0);
    const put = await agent.put('/api/settings/business').send({ ...g, phone1: '300 000 0000' }).expect(200);
    expect(put.body.phone1).toBe('300 000 0000');
    expect((await agent.get('/api/settings/business')).body.phone1).toBe('300 000 0000');
    await agent.put('/api/settings/business').send({ ...g, storeName: '' }).expect(422);
  });
});
