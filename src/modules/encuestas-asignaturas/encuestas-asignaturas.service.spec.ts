import { EncuestasAsignaturasService } from './encuestas-asignaturas.service';
import { mockRepository } from '../../test/test-utils';

const PERIODO = {
  id: 'p-1',
  nombre: '2026-1',
  activo: true,
  encuestaAsignaturasActiva: true,
  fechaInicioAsignaturas: '2026-01-01',
  fechaFinAsignaturas: '2026-12-31',
  createdAt: new Date(),
};

function build() {
  const respuestas = mockRepository();
  const items = mockRepository();
  const inscripciones = mockRepository();
  const asignaturas = mockRepository();
  const periodos = mockRepository();
  const usuarios = mockRepository();
  const periodosService = {
    activo: jest.fn().mockResolvedValue(PERIODO),
    esEncuestaAsignaturasVigente: jest.fn().mockReturnValue(true),
  };
  const service = new EncuestasAsignaturasService(
    respuestas as never,
    items as never,
    inscripciones as never,
    asignaturas as never,
    periodos as never,
    usuarios as never,
    periodosService as never,
    {} as never,
  );
  return { service, respuestas, inscripciones, asignaturas, periodos, usuarios };
}

describe('EncuestasAsignaturasService respuestas minimizadas', () => {
  test('estado solo incluye datos del periodo y asignaturas que necesita la pantalla', async () => {
    const { service, respuestas, inscripciones, asignaturas, periodos, usuarios } = build();
    usuarios.findOne.mockResolvedValue({ id: 'u-1' });
    periodos.findOne.mockResolvedValue(PERIODO);
    respuestas.findOne.mockResolvedValue(null);
    inscripciones.find.mockResolvedValue([]);
    asignaturas.find.mockResolvedValue([{
      id: 'a-1',
      nombre: 'Álgebra',
      codigo: 'MAT-1',
      semestre: 1,
      activo: true,
      createdAt: new Date(),
    }]);

    const estado = await service.obtenerEstadoParaEstudiante('u-1');
    expect(estado.periodo).toEqual({ id: 'p-1', nombre: '2026-1', activo: true });
    expect(estado.todasAsignaturas).toEqual([{
      id: 'a-1',
      nombre: 'Álgebra',
      codigo: 'MAT-1',
      semestre: 1,
    }]);
    expect(estado.periodo).not.toHaveProperty('createdAt');
    expect(estado.todasAsignaturas[0]).not.toHaveProperty('createdAt');
  });

  test('la respuesta propia omite usuarioId, periodoId y marcas de persistencia', async () => {
    const { service, respuestas, periodos, asignaturas } = build();
    periodos.findOne.mockResolvedValue(PERIODO);
    respuestas.findOne.mockResolvedValue({
      id: 'r-1',
      usuarioId: 'u-1',
      periodoId: 'p-1',
      semestreAlResponder: 4,
      createdAt: new Date(),
      updatedAt: new Date(),
      items: [{
        id: 'i-1',
        respuestaAsignaturaId: 'r-1',
        asignaturaId: 'a-1',
        tieneDificultad: true,
        nivelSatisfaccion: 2,
        createdAt: new Date(),
      }],
    });
    asignaturas.find.mockResolvedValue([{
      id: 'a-1',
      nombre: 'Álgebra',
      codigo: 'MAT-1',
      semestre: 1,
      activo: true,
      createdAt: new Date(),
    }]);

    await expect(service.miRespuesta('u-1', 'p-1')).resolves.toEqual({
      id: 'r-1',
      items: [{
        id: 'i-1',
        asignaturaId: 'a-1',
        tieneDificultad: true,
        nivelSatisfaccion: 2,
        asignatura: { id: 'a-1', nombre: 'Álgebra', codigo: 'MAT-1', semestre: 1 },
      }],
    });
  });
});
