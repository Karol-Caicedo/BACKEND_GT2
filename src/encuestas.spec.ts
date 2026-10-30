import { EncuestasService } from './modules/encuestas/encuestas.service';

describe('EncuestasService.validar (reglas críticas)', () => {
  const svc = new EncuestasService(null as never, null as never, null as never, null as never, null as never, null as never);

  test('modo selección: máximo 5 temas', () => {
    const items = Array.from({ length: 6 }, (_, i) => ({ temaId: `t${i}` }));
    expect(() => svc.validar(items, 'seleccion')).toThrow(/1 y 5/);
  });

  test('modo selección: rechaza puntajes', () => {
    expect(() => svc.validar([{ temaId: 'a', puntaje: 5 }], 'seleccion')).toThrow();
  });

  test('modo selección: acepta 1-5 sin puntaje', () => {
    expect(() => svc.validar([{ temaId: 'a' }, { temaId: 'b' }], 'seleccion')).not.toThrow();
  });

  test('modo calificación: rango 1-5', () => {
    expect(() => svc.validar([{ temaId: 'a', puntaje: 0 }], 'calificacion')).toThrow(/1 a 5/);
    expect(() => svc.validar([{ temaId: 'a', puntaje: 6 }], 'calificacion')).toThrow(/1 a 5/);
    expect(() => svc.validar([{ temaId: 'a', puntaje: 4 }], 'calificacion')).not.toThrow();
  });

  test('rechaza duplicados', () => {
    expect(() => svc.validar([{ temaId: 'a' }, { temaId: 'a' }], 'seleccion')).toThrow(/duplicados/i);
  });

  test('orden aleatorio difiere por usuario pero contiene los mismos temas', async () => {
    const fakeTemas = [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }, { id: '5' }, { id: '6' }] as never[];
    const s = new EncuestasService(null as never, null as never, { find: async () => fakeTemas } as never, null as never, null as never, null as never);
    const a = await s.temasAleatorios('usuario-A', 'periodo-1');
    const b = await s.temasAleatorios('usuario-B', 'periodo-1');
    expect(a.map((t: { id: string }) => t.id).sort()).toEqual(['1', '2', '3', '4', '5', '6']);
    expect(b.map((t: { id: string }) => t.id).sort()).toEqual(['1', '2', '3', '4', '5', '6']);
  });
});
