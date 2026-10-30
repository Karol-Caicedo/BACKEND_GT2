import { NotFoundException } from '@nestjs/common';
import { CapacitacionesService } from './capacitaciones.service';
import { mockRepository } from '../../test/test-utils';
import { Capacitacion, CapacitacionSemestre } from './capacitacion.entity';
import { ClicCapacitacion } from './clic.entity';

function buildService() {
  const cap = mockRepository();
  const sem = mockRepository();
  const clic = mockRepository();
  const repos = new Map<unknown, unknown>([
    [Capacitacion, cap],
    [CapacitacionSemestre, sem],
    [ClicCapacitacion, clic],
  ]);
  const manager = { getRepository: jest.fn((entidad: unknown) => repos.get(entidad)) };
  const dataSource = { transaction: jest.fn((cb: (m: unknown) => unknown) => cb(manager)) };
  const svc = new CapacitacionesService(
    cap as never,
    sem as never,
    clic as never,
    dataSource as never,
  );
  return { svc, cap, sem, clic, dataSource, manager };
}

const DTO_BASE = {
  titulo: 'Taller de nube',
  descripcion: 'Intro práctica',
  enlace: 'https://ejemplo.com/nube',
};

const ALUMNO = { id: 'u-7', rol: 'ESTUDIANTE', semestre: 4 };
const ADMIN = { id: 'admin-1', rol: 'ADMIN', semestre: 1 };

describe('CapacitacionesService', () => {
  describe('esVigente (fronteras)', () => {
    const ahora = new Date('2026-09-01T12:00:00Z');
    test.each([
      ['borrador sin ventanas', { estado: 'borrador' }, false],
      ['estado desconocido', { estado: 'archivado' }, false],
      ['publicada sin ventanas', { estado: 'publicado' }, true],
      ['visibleDesde igual a ahora (límite inclusivo)', { estado: 'publicado', visibleDesde: '2026-09-01T12:00:00Z' }, true],
      ['visibleHasta igual a ahora (límite inclusivo)', { estado: 'publicado', visibleHasta: '2026-09-01T12:00:00Z' }, true],
      ['visibleDesde un segundo después', { estado: 'publicado', visibleDesde: '2026-09-01T12:00:01Z' }, false],
      ['visibleHasta un segundo antes', { estado: 'publicado', visibleHasta: '2026-09-01T11:59:59Z' }, false],
      ['acepta Date además de string', { estado: 'publicado', visibleDesde: new Date('2026-01-01'), visibleHasta: new Date('2026-12-31') }, true],
    ])('%s', (_c, cap, esperado) => {
      expect(CapacitacionesService.esVigente(cap, ahora)).toBe(esperado);
    });
  });

  describe('crear', () => {
    test('aplica valores por defecto y semestres 1-9', async () => {
      const { svc, cap, sem, clic } = buildService();
      cap.save.mockImplementation((e: unknown) => Promise.resolve({ id: 'c-1', ...(e as object) }));
      cap.findOne.mockResolvedValue({ id: 'c-1', semestres: [] });
      clic.count.mockResolvedValue(0);
      const r = await svc.crear({ ...DTO_BASE }, null, 'admin-1');
      expect(cap.create).toHaveBeenCalledWith(
        expect.objectContaining({
          modalidad: 'virtual',
          estado: 'borrador',
          imagenUrl: null,
          temaId: null,
          fechaEvento: null,
          visibleDesde: null,
          visibleHasta: null,
          createdBy: 'admin-1',
        }),
      );
      const filas = sem.save.mock.calls[0][0] as Array<{ semestre: number }>;
      expect(filas).toHaveLength(9);
      expect(filas.map((f: { semestre: number }) => f.semestre).sort((a: number, b: number) => a - b))
        .toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      expect(r).toMatchObject({ id: 'c-1', clics: 0 });
    });

    test('respeta semestres explícitos y convierte fechas', async () => {
      const { svc, cap, sem, clic } = buildService();
      cap.save.mockImplementation((e: unknown) => Promise.resolve({ id: 'c-1', ...(e as object) }));
      cap.findOne.mockResolvedValue({ id: 'c-1', semestres: [] });
      clic.count.mockResolvedValue(0);
      await svc.crear(
        { ...DTO_BASE, modalidad: 'presencial', estado: 'publicado', fechaEvento: '2026-10-01T10:00:00Z', semestres: ['4', '5'] as never },
        '/uploads/a.png',
        'admin-1',
      );
      expect(cap.create).toHaveBeenCalledWith(
        expect.objectContaining({ modalidad: 'presencial', estado: 'publicado', imagenUrl: '/uploads/a.png' }),
      );
      expect((cap.create.mock.calls[0][0] as Record<string, any>).fechaEvento).toEqual(new Date('2026-10-01T10:00:00Z'));
      expect((sem.save.mock.calls[0][0] as Array<{ semestre: number }>).map((f: { semestre: number }) => f.semestre)).toEqual([4, 5]);
    });
  });

  describe('detalle', () => {
    test('inexistente → 404', async () => {
      const { svc, cap } = buildService();
      cap.findOne.mockResolvedValue(null);
      await expect(svc.detalle('x')).rejects.toThrow(NotFoundException);
    });

    test('incluye conteo de clics', async () => {
      const { svc, cap, clic } = buildService();
      cap.findOne.mockResolvedValue({ id: 'c-1', titulo: 'T' });
      clic.count.mockResolvedValue(7);
      await expect(svc.detalle('c-1')).resolves.toMatchObject({ id: 'c-1', clics: 7 });
      expect(clic.count).toHaveBeenCalledWith({ where: { capacitacionId: 'c-1' } });
    });
  });

  describe('detallePara (control de acceso por recurso)', () => {
    const publicada = {
      id: 'c-1',
      estado: 'publicado',
      visibleDesde: null,
      visibleHasta: null,
      semestres: [{ semestre: 4 }],
    };

    test('estudiante del semestre destino ve una capacitación publicada', async () => {
      const { svc, cap, clic } = buildService();
      cap.findOne.mockResolvedValue({
        ...publicada,
        titulo: 'Taller',
        descripcion: 'Descripción',
        enlace: 'https://ejemplo.com',
        createdBy: 'admin-1',
        createdAt: new Date(),
      });
      const respuesta = await svc.detallePara('c-1', ALUMNO);
      expect(respuesta).toMatchObject({ id: 'c-1', titulo: 'Taller', enlace: 'https://ejemplo.com' });
      expect(respuesta).not.toHaveProperty('clics');
      expect(respuesta).not.toHaveProperty('createdBy');
      expect(respuesta).not.toHaveProperty('createdAt');
      expect(clic.count).not.toHaveBeenCalled();
    });

    test.each([
      ['borrador', { ...publicada, estado: 'borrador' }],
      ['vencida', { ...publicada, visibleHasta: '2020-01-01T00:00:00Z' }],
      ['futura', { ...publicada, visibleDesde: '2999-01-01T00:00:00Z' }],
      ['otro semestre', { ...publicada, semestres: [{ semestre: 5 }] }],
      ['sin semestres', { ...publicada, semestres: [] }],
    ])('estudiante no ve %s → 404', async (_caso, capData) => {
      const { svc, cap } = buildService();
      cap.findOne.mockResolvedValue(capData);
      await expect(svc.detallePara('c-1', ALUMNO)).rejects.toThrow(NotFoundException);
    });

    test('admin ve borradores', async () => {
      const { svc, cap, clic } = buildService();
      cap.findOne.mockResolvedValue({ ...publicada, estado: 'borrador' });
      clic.count.mockResolvedValue(0);
      await expect(svc.detallePara('c-1', ADMIN)).resolves.toMatchObject({ id: 'c-1', estado: 'borrador' });
    });
  });

  describe('actualizar', () => {
    test('inexistente → 404', async () => {
      const { svc, cap } = buildService();
      cap.findOne.mockResolvedValue(null);
      await expect(svc.actualizar('x', { ...DTO_BASE })).rejects.toThrow(NotFoundException);
    });

    test('parcial: conserva campos no enviados y no toca semestres', async () => {
      const { svc, cap, sem, clic } = buildService();
      const actual = { id: 'c-1', titulo: 'Viejo', descripcion: 'D', enlace: 'https://x.co', modalidad: 'virtual', estado: 'borrador', temaId: null };
      cap.findOne.mockResolvedValueOnce(actual).mockResolvedValueOnce({ ...actual, titulo: 'Nuevo' });
      clic.count.mockResolvedValue(0);
      await svc.actualizar('c-1', { titulo: 'Nuevo' } as never);
      expect(actual.titulo).toBe('Nuevo');
      expect(actual.modalidad).toBe('virtual');
      expect(sem.delete).not.toHaveBeenCalled();
      expect(cap.save).toHaveBeenCalledWith(actual);
    });

    test('con semestres: reemplaza el conjunto completo', async () => {
      const { svc, cap, sem, clic } = buildService();
      cap.findOne.mockResolvedValueOnce({ id: 'c-1' }).mockResolvedValueOnce({ id: 'c-1' });
      clic.count.mockResolvedValue(0);
      await svc.actualizar('c-1', { ...DTO_BASE, semestres: [9] });
      expect(sem.delete).toHaveBeenCalledWith({ capacitacionId: 'c-1' });
      expect(sem.save.mock.calls[0][0]).toEqual([{ capacitacionId: 'c-1', semestre: 9 }]);
    });

    test('imagen undefined no la pisa; null la limpia', async () => {
      const { svc, cap, sem, clic } = buildService();
      cap.findOne.mockResolvedValueOnce({ id: 'c-1', imagenUrl: '/uploads/vieja.png' }).mockResolvedValueOnce({ id: 'c-1' });
      clic.count.mockResolvedValue(0);
      await svc.actualizar('c-1', { ...DTO_BASE });
      expect((cap.save.mock.calls[0][0] as Record<string, any>).imagenUrl).toBe('/uploads/vieja.png');
      void sem; void clic;
    });
  });

  describe('eliminar / registrarClic / destinatarios / conteoClics', () => {
    test('eliminar inexistente → 404; existente → { ok: true }', async () => {
      const { svc, cap } = buildService();
      cap.findOne.mockResolvedValue(null);
      await expect(svc.eliminar('x')).rejects.toThrow(NotFoundException);
      cap.findOne.mockResolvedValue({ id: 'c-1' });
      await expect(svc.eliminar('c-1')).resolves.toEqual({ ok: true });
      expect(cap.remove).toHaveBeenCalledWith({ id: 'c-1' });
    });

    test('registrarClic en inexistente → 404', async () => {
      const { svc, cap } = buildService();
      cap.findOne.mockResolvedValue(null);
      await expect(svc.registrarClic('x', ALUMNO)).rejects.toThrow(NotFoundException);
    });

    test.each([
      ['borrador', { estado: 'borrador' }],
      ['vencida', { estado: 'publicado', visibleHasta: '2020-01-01T00:00:00Z' }],
      ['futura', { estado: 'publicado', visibleDesde: '2999-01-01T00:00:00Z' }],
      ['otro semestre', { estado: 'publicado', semestres: [{ semestre: 5 }] }],
      ['sin semestres', { estado: 'publicado', semestres: [] }],
    ])('registrarClic no permite una capacitación %s', async (_caso, extra) => {
      const { svc, cap, clic } = buildService();
      cap.findOne.mockResolvedValue({
        id: 'c-1',
        enlace: 'https://destino.co',
        visibleDesde: null,
        visibleHasta: null,
        semestres: [{ semestre: 4 }],
        ...extra,
      });
      await expect(svc.registrarClic('c-1', ALUMNO)).rejects.toThrow(NotFoundException);
      expect(clic.save).not.toHaveBeenCalled();
    });

    test('registrarClic guarda y devuelve el enlace para redirigir', async () => {
      const { svc, cap, clic } = buildService();
      cap.findOne.mockResolvedValue({
        id: 'c-1',
        enlace: 'https://destino.co',
        estado: 'publicado',
        semestres: [{ semestre: 4 }],
      });
      await expect(svc.registrarClic('c-1', ALUMNO)).resolves.toEqual({ enlace: 'https://destino.co' });
      expect(clic.create).toHaveBeenCalledWith({ capacitacionId: 'c-1', usuarioId: 'u-7' });
      expect(clic.save).toHaveBeenCalledTimes(1);
    });

    test('destinatarios sin semestres → [] y mapea correos', async () => {
      const { svc, sem, cap } = buildService();
      sem.find.mockResolvedValue([]);
      await expect(svc.destinatarios('c-1')).resolves.toEqual([]);
      expect(cap.manager.query).not.toHaveBeenCalled();

      sem.find.mockResolvedValue([{ semestre: 4 }, { semestre: 5 }]);
      cap.manager.query.mockResolvedValue([{ correo: 'a@u.edu.co' }, { correo: 'b@u.edu.co' }]);
      await expect(svc.destinatarios('c-1')).resolves.toEqual(['a@u.edu.co', 'b@u.edu.co']);
      expect(cap.manager.query).toHaveBeenCalledWith(expect.stringContaining('SELECT correo'), ['ESTUDIANTE', [4, 5]]);
    });

    test('conteoClics vacío no toca la BD', async () => {
      const { svc, clic } = buildService();
      await expect(svc.conteoClics([])).resolves.toEqual([]);
      expect(clic.manager.query).not.toHaveBeenCalled();
    });
  });
});
