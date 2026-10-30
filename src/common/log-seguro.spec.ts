import { detalleErrorParaLog, redactarTexto } from './log-seguro';

describe('redacción de logs', () => {
  test('redacta direcciones de correo en mensajes y stacks', () => {
    const error = new Error('Cuenta usuario@ejemplo.edu.co no encontrada');
    error.stack = 'Error: usuario@ejemplo.edu.co';
    const detalle = detalleErrorParaLog(error);
    expect(detalle.message).not.toContain('usuario@ejemplo.edu.co');
    expect(detalle.stack).not.toContain('usuario@ejemplo.edu.co');
    expect(detalle.message).toContain('[correo redactado]');
  });

  test('oculta contraseñas, tokens y cookies sin borrar el contexto', () => {
    const texto = 'login password=ClaveSecreta token=abc.def Authorization: Bearer xyz cookie=sid';
    const limpio = redactarTexto(texto);
    expect(limpio).not.toContain('ClaveSecreta');
    expect(limpio).not.toContain('abc.def');
    expect(limpio).not.toContain('xyz');
    expect(limpio).not.toContain('sid');
    expect(limpio).toContain('password=');
    expect(limpio).toContain('[redactado]');
  });

  test('el detalle de error no incluye parámetros SQL ni secretos del stack', () => {
    const err = new Error('duplicate key password=ClaveSecreta');
    err.stack = 'Error: duplicate key password=ClaveSecreta\n    at Query.run';
    (err as Error & { parameters?: unknown[] }).parameters = ['ClaveSecreta', 'hash'];
    const detalle = detalleErrorParaLog(err);
    expect(detalle.message).not.toContain('ClaveSecreta');
    expect(detalle.stack).not.toContain('ClaveSecreta');
    expect(JSON.stringify(detalle)).not.toContain('parameters');
  });
});
