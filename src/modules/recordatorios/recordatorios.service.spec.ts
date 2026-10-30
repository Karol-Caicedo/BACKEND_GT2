import { RecordatoriosService } from './recordatorios.service';
import { mockRepository } from '../../test/test-utils';

function buildService() {
  const rec = mockRepository();
  const periodos = mockRepository();
  const users = mockRepository();
  const resp = mockRepository();
  const mail = { enviar: jest.fn().mockResolvedValue({ simulado: true }) };
  const svc = new RecordatoriosService(rec as never, periodos as never, users as never, resp as never, mail as never);
  return { svc, rec, periodos, users, resp, mail };
}

const PERIODO = (diasAtras: number) => ({
  id: 'p-1',
  nombre: '2026-1',
  fechaInicio: new Date(Date.now() - diasAtras * 86400000).toISOString().slice(0, 10),
});

describe('RecordatoriosService', () => {
  describe('numeroAEnviar: tabla de decisión completa', () => {
    const f = RecordatoriosService.numeroAEnviar;
    test.each([
      [0, [], null],
      [6, [], null],
      [6, [1], null],
      [7, [], 1],
      [8, [], 1],
      [13, [1], null],
      [14, [], 1], // el #1 tiene prioridad aunque ya aplique el #2
      [14, [1], 2],
      [20, [1], 2],
      [30, [], 1],
      [30, [2], 1], // solo tiene el #2 → aún le falta el #1
      [30, [1, 2], null],
      [100, [1, 2], null],
      [100, [1, 1], null], // duplicado defensivo: 2 registros = tope
    ])('día %i con enviados %j → %j', (dias, enviados, esperado) => {
      expect(f(dias, enviados)).toBe(esperado);
    });
  });

  describe('cronDiario', () => {
    test('sin periodo activo → 0 envíos y no consulta estudiantes', async () => {
      const { svc, periodos, users } = buildService();
      periodos.findOne.mockResolvedValue(null);
      await expect(await svc.cronDiario()).toEqual({ enviados: 0 });
      expect(users.find).not.toHaveBeenCalled();
    });

    test('omite a quienes ya respondieron', async () => {
      const { svc, periodos, users, resp, rec, mail } = buildService();
      periodos.findOne.mockResolvedValue(PERIODO(8));
      users.find.mockResolvedValue([{ id: 'u-1', correo: 'a@u.edu.co', nombre: 'A' }]);
      resp.findOne.mockResolvedValue({ id: 'r-1' });
      const r = await svc.cronDiario();
      expect(r).toEqual({ enviados: 0 });
      expect(mail.enviar).not.toHaveBeenCalled();
      expect(rec.save).not.toHaveBeenCalled();
    });

    test('día 8: envía #1 y lo registra (máx 2 por periodo)', async () => {
      const { svc, periodos, users, resp, rec, mail } = buildService();
      periodos.findOne.mockResolvedValue(PERIODO(8));
      users.find.mockResolvedValue([{ id: 'u-1', correo: 'a@u.edu.co', nombre: 'Ana' }]);
      resp.findOne.mockResolvedValue(null);
      rec.find.mockResolvedValue([]);
      const r = await svc.cronDiario();
      expect(r).toEqual({ enviados: 1 });
      expect(mail.enviar).toHaveBeenCalledTimes(1);
      expect(mail.enviar.mock.calls[0][0]).toEqual(['a@u.edu.co']);
      expect(mail.enviar.mock.calls[0][1]).toContain('2026-1');
      expect(rec.create).toHaveBeenCalledWith({ usuarioId: 'u-1', periodoId: 'p-1', numero: 1 });
    });

    test('segunda corrida el mismo ciclo no duplica', async () => {
      const { svc, periodos, users, resp, rec, mail } = buildService();
      periodos.findOne.mockResolvedValue(PERIODO(8));
      users.find.mockResolvedValue([{ id: 'u-1', correo: 'a@u.edu.co', nombre: 'Ana' }]);
      resp.findOne.mockResolvedValue(null);
      rec.find.mockResolvedValue([{ numero: 1 }]);
      await expect(svc.cronDiario()).resolves.toEqual({ enviados: 0 });
      expect(mail.enviar).not.toHaveBeenCalled();
    });

    test('día 15 con #1 previo: envía #2; luego tope alcanzado', async () => {
      const { svc, periodos, users, resp, rec, mail } = buildService();
      periodos.findOne.mockResolvedValue(PERIODO(15));
      users.find.mockResolvedValue([{ id: 'u-1', correo: 'a@u.edu.co', nombre: 'Ana' }]);
      resp.findOne.mockResolvedValue(null);
      rec.find.mockResolvedValue([{ numero: 1 }]);
      await expect(svc.cronDiario()).resolves.toEqual({ enviados: 1 });
      expect(rec.create).toHaveBeenCalledWith({ usuarioId: 'u-1', periodoId: 'p-1', numero: 2 });

      rec.find.mockResolvedValue([{ numero: 1 }, { numero: 2 }]);
      await expect(svc.cronDiario()).resolves.toEqual({ enviados: 0 });
      expect(mail.enviar).toHaveBeenCalledTimes(1);
    });

    test('procesa varios estudiantes y mezcla respondedores con pendientes', async () => {
      const { svc, periodos, users, resp, rec } = buildService();
      periodos.findOne.mockResolvedValue(PERIODO(10));
      users.find.mockResolvedValue([
        { id: 'u-1', correo: 'a@u.edu.co', nombre: 'A' },
        { id: 'u-2', correo: 'b@u.edu.co', nombre: 'B' },
        { id: 'u-3', correo: 'c@u.edu.co', nombre: 'C' },
      ]);
      resp.findOne.mockImplementation((criterio: { where: { usuarioId: string } }) =>
        Promise.resolve(criterio?.where?.usuarioId === 'u-2' ? { id: 'r-2' } : null),
      );
      rec.find.mockResolvedValue([]);
      await expect(svc.cronDiario()).resolves.toEqual({ enviados: 2 });
    });
  });

  describe('resumen', () => {
    test('sin periodo → ceros', async () => {
      const { svc, periodos } = buildService();
      periodos.findOne.mockResolvedValue(null);
      await expect(await svc.resumen()).toEqual({ total: 0, porNumero: {}, tasaPosterior: 0 });
    });

    test('agrega por número y calcula tasa posterior por usuario único', async () => {
      const { svc, periodos, rec, resp } = buildService();
      periodos.findOne.mockResolvedValue({ id: 'p-1', nombre: '2026-1' });
      rec.find.mockResolvedValue([
        { usuarioId: 'u-1', numero: 1 },
        { usuarioId: 'u-2', numero: 1 },
        { usuarioId: 'u-1', numero: 2 },
      ]);
      resp.findOne.mockImplementation((criterio: { where: { usuarioId: string } }) =>
        Promise.resolve(criterio?.where?.usuarioId === 'u-1' ? { id: 'r-1' } : null),
      );
      const r = await svc.resumen('p-1');
      expect(r).toMatchObject({ periodo: '2026-1', total: 3, porNumero: { 1: 2, 2: 1 }, recordados: 2, respondieronDespues: 1, tasaPosterior: 0.5 });
    });

    test('sin recordados → tasa 0 (sin división por cero)', async () => {
      const { svc, periodos, rec } = buildService();
      periodos.findOne.mockResolvedValue({ id: 'p-1', nombre: '2026-1' });
      rec.find.mockResolvedValue([]);
      const r = await svc.resumen();
      expect(r.tasaPosterior).toBe(0);
    });
  });
});
