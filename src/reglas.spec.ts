import { CapacitacionesService } from './modules/capacitaciones/capacitaciones.service';
import { RecordatoriosService } from './modules/recordatorios/recordatorios.service';

describe('CapacitacionesService.esVigente', () => {
  const ahora = new Date('2026-09-01T12:00:00Z');
  test('publicada sin ventanas es vigente', () => {
    expect(CapacitacionesService.esVigente({ estado: 'publicado' }, ahora)).toBe(true);
  });
  test('borrador nunca es vigente', () => {
    expect(CapacitacionesService.esVigente({ estado: 'borrador' }, ahora)).toBe(false);
  });
  test('respeta visible_desde / visible_hasta', () => {
    expect(CapacitacionesService.esVigente({ estado: 'publicado', visibleDesde: '2026-10-01' }, ahora)).toBe(false);
    expect(CapacitacionesService.esVigente({ estado: 'publicado', visibleHasta: '2026-01-01' }, ahora)).toBe(false);
    expect(
      CapacitacionesService.esVigente({ estado: 'publicado', visibleDesde: '2026-01-01', visibleHasta: '2026-12-31' }, ahora),
    ).toBe(true);
  });
});

describe('RecordatoriosService.numeroAEnviar', () => {
  const f = RecordatoriosService.numeroAEnviar;
  test('menos de 7 días: ninguno', () => {
    expect(f(3, [])).toBeNull();
  });
  test('7 días: primero', () => {
    expect(f(7, [])).toBe(1);
  });
  test('14 días: segundo', () => {
    expect(f(14, [1])).toBe(2);
  });
  test('máximo 2, no duplicar', () => {
    expect(f(30, [1, 2])).toBeNull();
    expect(f(30, [1])).toBe(2);
    expect(f(8, [1])).toBeNull();
  });
});
