import { describe, expect, it } from 'vitest';
import { loggedInAgent, testContext } from '../helpers';

type Agent = Awaited<ReturnType<typeof loggedInAgent>>['agent'];

const business = async (agent: Agent) => (await agent.get('/api/settings/business').expect(200)).body;

describe('límite de las políticas de compra', () => {
  it('acepta políticas hasta 3500 caracteres en total', async () => {
    const { agent } = await loggedInAgent(testContext());
    const b = await business(agent);
    const terms = [
      { title: 'A', body: 'x'.repeat(1200) },
      { title: 'B', body: 'y'.repeat(1200) },
      { title: 'C', body: 'z'.repeat(1100) }, // 3500 exactos
    ];
    await agent.put('/api/settings/business').send({ ...b, terms }).expect(200);
  });

  it('rechaza más de 3500 caracteres en total con invalid_business y detalles', async () => {
    const { agent } = await loggedInAgent(testContext());
    const b = await business(agent);
    const terms = [
      { title: 'A', body: 'x'.repeat(1200) },
      { title: 'B', body: 'y'.repeat(1200) },
      { title: 'C', body: 'z'.repeat(1101) }, // 3501
    ];
    const res = await agent.put('/api/settings/business').send({ ...b, terms }).expect(422);
    expect(res.body.error).toBe('invalid_business');
    expect(res.body.details.map((d: { field: string }) => d.field)).toContain('terms');
    const detail = res.body.details.find((d: { field: string }) => d.field === 'terms');
    expect(detail.message).toMatch(/políticas/i);
    expect(detail.message).toContain('3500');
    // se conservan las políticas anteriores
    expect((await business(agent)).terms).toEqual(b.terms);
  });

  it('los demás errores de validación del negocio también usan invalid_business', async () => {
    const { agent } = await loggedInAgent(testContext());
    const b = await business(agent);
    const res = await agent.put('/api/settings/business').send({ ...b, storeName: '' }).expect(422);
    expect(res.body.error).toBe('invalid_business');
    expect(res.body.details[0]).toMatchObject({ field: 'storeName' });
  });

  it('un título o texto vacío sigue siendo válido como antes (solo el título es obligatorio)', async () => {
    const { agent } = await loggedInAgent(testContext());
    const b = await business(agent);
    await agent.put('/api/settings/business').send({ ...b, terms: [{ title: 'Solo título', body: '' }] }).expect(200);
    await agent.put('/api/settings/business').send({ ...b, terms: [{ title: '', body: 'x' }] }).expect(422);
  });
});
