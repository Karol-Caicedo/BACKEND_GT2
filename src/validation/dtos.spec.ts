/** Validación de entrada (frontend + backend): reglas de DTOs con class-validator. */
import { validate, ValidationError } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { RegisterDto, LoginDto, LoginEnvelopeDto, CompleteSsoDto, CompletarSsoDto, SolicitarRecuperacionDto, RestablecerClaveDto } from '../modules/auth/auth.dto';
import { CrearUsuarioDto } from '../modules/users/user.dto';
import { CrearEncuestaDto } from '../modules/encuestas/encuesta.dto';
import { ActualizarCapacitacionDto, CapacitacionDto, FiltroCapDto } from '../modules/capacitaciones/capacitacion.dto';
import { CreatePeriodoDto } from '../modules/periodos/periodo.dto';
import { TemaDto } from '../modules/temas/temas.service';

function aplanar(e: ValidationError): string[] {
  return [...Object.values(e.constraints ?? {}), ...(e.children ?? []).flatMap(aplanar)];
}

async function errores(dto: object): Promise<string[]> {
  return (await validate(dto as never)).flatMap(aplanar);
}

const registroOk = () =>
  Object.assign(new RegisterDto(), {
    correo: 'est@unipacifico.edu.co',
    nombre: 'Est',
    password: 'Clave1234',
    semestre: 5,
    aceptoDatos: true,
  });

describe('DTOs: RegisterDto (Ley 1581 + dominio + semestre)', () => {
  test('válido no produce errores', async () => {
    await expect(errores(registroOk())).resolves.toEqual([]);
  });

  test.each([
    ['correo no email', { correo: 'no-es-correo' }],
    ['clave corta', { password: 'abc123' }],
    ['semestre 0', { semestre: 0 }],
    ['semestre 10', { semestre: 10 }],
    ['semestre decimal', { semestre: 2.5 }],
    ['sin consentimiento', { aceptoDatos: false }],
    ['nombre ausente', { nombre: undefined }],
  ])('rechaza %s', async (_c, patch) => {
    const dto = Object.assign(registroOk(), patch);
    expect(await errores(dto)).not.toHaveLength(0);
  });
});

describe('DTOs: LoginDto y CompleteSsoDto', () => {
  test('login válido / inválido', async () => {
    const ok = Object.assign(new LoginDto(), { correo: 'a@unipacifico.edu.co', password: 'x' });
    await expect(errores(ok)).resolves.toEqual([]);
    const mal = Object.assign(new LoginDto(), { correo: 'zzz', password: '' });
    expect(await errores(mal)).not.toHaveLength(0);
  });

  test('el sobre cifrado no acepta campos originales de credenciales', async () => {
    const sobre = plainToInstance(LoginEnvelopeDto, {
      version: 1,
      keyId: 'rsa-test',
      challenge: 'A'.repeat(43),
      wrappedKey: 'A'.repeat(512),
      iv: 'A'.repeat(16),
      ciphertext: 'A'.repeat(32),
      correo: 'persona@unipacifico.edu.co',
      password: 'Clave-de-prueba-984',
    });
    const errors = await validate(sobre, { whitelist: true, forbidNonWhitelisted: true });
    expect(errors.map((error) => error.property)).toContain('correo');
    expect(errors.map((error) => error.property)).toContain('password');
  });

  test('SSO exige semestre 1-9 y consentimiento', async () => {
    const ok = Object.assign(new CompleteSsoDto(), { semestre: 9, aceptoDatos: true });
    await expect(errores(ok)).resolves.toEqual([]);
    const mal = Object.assign(new CompleteSsoDto(), { semestre: 12, aceptoDatos: false });
    expect(await errores(mal)).not.toHaveLength(0);
  });

  test('CompletarSsoDto exige token temporal', async () => {
    const ok = plainToInstance(CompletarSsoDto, { temp: 'jwt-temporal', semestre: 5, aceptoDatos: true });
    await expect(errores(ok)).resolves.toEqual([]);
    const mal = plainToInstance(CompletarSsoDto, { semestre: 5, aceptoDatos: true });
    expect(await errores(mal)).not.toHaveLength(0);
  });
});

describe('DTOs: CrearEncuestaDto', () => {
  const UUIDS = ['123e4567-e89b-42d3-a456-426614174000', '123e4567-e89b-42d3-a456-426614174001'];

  test('selección válida (uuids) pasa', async () => {
    const dto = plainToInstance(CrearEncuestaDto, { items: UUIDS.map((temaId) => ({ temaId })) });
    await expect(errores(dto)).resolves.toEqual([]);
  });

  test('items vacío, uuid inválido y puntaje fuera de rango fallan', async () => {
    const vacio = plainToInstance(CrearEncuestaDto, { items: [] });
    expect(await errores(vacio)).not.toHaveLength(0);

    const uuidMal = plainToInstance(CrearEncuestaDto, { items: [{ temaId: 'abc' }] });
    expect((await errores(uuidMal)).join()).toMatch(/temaId inválido/);

    const puntajeMal = plainToInstance(CrearEncuestaDto, { items: [{ temaId: UUIDS[0], puntaje: 9 }] });
    expect(await errores(puntajeMal)).not.toHaveLength(0);
  });

  test('acepta string JSON (multipart) vía Transform', async () => {
    const dto = plainToInstance(CrearEncuestaDto, {
      items: JSON.stringify([{ temaId: UUIDS[0] }]),
    });
    await expect(errores(dto)).resolves.toEqual([]);
  });
});

describe('DTOs: CapacitacionDto (incluye Transform de semestres)', () => {
  const base = { titulo: 'T', descripcion: 'D', enlace: 'https://ejemplo.com/x' };

  test('mínimo válido pasa', async () => {
    await expect(errores(plainToInstance(CapacitacionDto, base))).resolves.toEqual([]);
  });

  test.each([
    ['url inválida', { enlace: 'no-url' }],
    ['modalidad inválida', { modalidad: 'hibrida' }],
    ['estado inválido', { estado: 'archivada' }],
    ['fecha inválida', { fechaEvento: 'ayer' }],
  ])('rechaza %s', async (_c, patch) => {
    expect(await errores(plainToInstance(CapacitacionDto, { ...base, ...patch }))).not.toHaveLength(0);
  });

  test.each([
    ['"todos"', 'todos', [1, 2, 3, 4, 5, 6, 7, 8, 9]],
    ['"4,5"', '4,5', [4, 5]],
    ['JSON', '[7,8]', [7, 8]],
    ['arreglo', [2], [2]],
  ])('semestres %s → %j', async (_c, entrada, esperado) => {
    const dto = plainToInstance(CapacitacionDto, { ...base, semestres: entrada });
    await expect(errores(dto)).resolves.toEqual([]);
    expect(dto.semestres).toEqual(esperado);
  });

  test("'' → undefined (opcional omitido)", async () => {
    const dto = plainToInstance(CapacitacionDto, { ...base, semestres: '' });
    expect(dto.semestres).toBeUndefined();
    await expect(errores(dto)).resolves.toEqual([]);
  });

  test.each([
    ['fuera de rango', [0, 10]],
    ['decimales', [2.5]],
    ['vacíos', []],
  ])('rechaza semestres %s', async (_c, semestres) => {
    expect(await errores(plainToInstance(CapacitacionDto, { ...base, semestres }))).not.toHaveLength(0);
  });

  test('FiltroCapDto: semestre 0/10 inválido, 5 válido', async () => {
    await expect(errores(plainToInstance(FiltroCapDto, { semestre: 5 }))).resolves.toEqual([]);
    expect(await errores(plainToInstance(FiltroCapDto, { semestre: 0 }))).not.toHaveLength(0);
    expect(await errores(plainToInstance(FiltroCapDto, { semestre: 10 }))).not.toHaveLength(0);
  });

  test('ActualizarCapacitacionDto valida los campos enviados en el PATCH', async () => {
    await expect(errores(plainToInstance(ActualizarCapacitacionDto, { titulo: 'Nuevo' }))).resolves.toEqual([]);
    expect(await errores(plainToInstance(ActualizarCapacitacionDto, { estado: 'archivada' }))).not.toHaveLength(0);
    expect(await errores(plainToInstance(ActualizarCapacitacionDto, { semestres: [10] }))).not.toHaveLength(0);
  });

  test('rechaza semestres duplicados en crear y actualizar', async () => {
    expect(await errores(plainToInstance(CapacitacionDto, { ...base, semestres: [4, 4] }))).not.toHaveLength(0);
    expect(await errores(plainToInstance(ActualizarCapacitacionDto, { semestres: [4, 4] }))).not.toHaveLength(0);
  });
});

describe('DTOs: CreatePeriodoDto y TemaDto', () => {
  test('periodo válido / modo inválido / fecha inválida', async () => {
    const ok = plainToInstance(CreatePeriodoDto, { nombre: '2026-1', fechaInicio: '2026-01-01', fechaFin: '2026-06-01', modoEncuesta: 'calificacion' });
    await expect(errores(ok)).resolves.toEqual([]);
    const malModo = plainToInstance(CreatePeriodoDto, { nombre: 'X', fechaInicio: '2026-01-01', fechaFin: '2026-06-01', modoEncuesta: 'puntos' });
    expect(await errores(malModo)).not.toHaveLength(0);
    const malFecha = plainToInstance(CreatePeriodoDto, { nombre: 'X', fechaInicio: 'enero', fechaFin: '2026-06-01' });
    expect(await errores(malFecha)).not.toHaveLength(0);
  });

  test('tema requiere nombre string', async () => {
    await expect(errores(plainToInstance(TemaDto, { nombre: 'IA' }))).resolves.toEqual([]);
    expect(await errores(plainToInstance(TemaDto, {}))).not.toHaveLength(0);
  });
});

describe('DTOs: recuperación de clave y creación admin de usuarios', () => {
  test('SolicitarRecuperacionDto exige email', async () => {
    const ok = plainToInstance(SolicitarRecuperacionDto, { correo: 'a@unipacifico.edu.co' });
    await expect(errores(ok)).resolves.toEqual([]);
    const mal = plainToInstance(SolicitarRecuperacionDto, { correo: 'no-es-correo' });
    expect(await errores(mal)).not.toHaveLength(0);
  });

  test('RestablecerClaveDto exige token y clave de 8+', async () => {
    const ok = plainToInstance(RestablecerClaveDto, { token: 'abcdef1234567890', password: 'Clave1234' });
    await expect(errores(ok)).resolves.toEqual([]);
    const mal = plainToInstance(RestablecerClaveDto, { token: 'corto', password: 'abc' });
    expect((await errores(mal)).length).toBeGreaterThanOrEqual(2);
  });

  test('CrearUsuarioDto valida rol, semestre e identificacion obligatoria', async () => {
    const ok = plainToInstance(CrearUsuarioDto, {
      correo: 'n@unipacifico.edu.co', nombre: 'N', password: 'Clave1234', numeroIdentificacion: '1234567890', semestre: 1, rol: 'ADMIN',
    });
    await expect(errores(ok)).resolves.toEqual([]);
    const mal = plainToInstance(CrearUsuarioDto, {
      correo: 'n@unipacifico.edu.co', nombre: 'N', password: 'Clave1234', semestre: 10, rol: 'SUPER',
    });
    expect((await errores(mal)).length).toBeGreaterThanOrEqual(2);
    const sinId = plainToInstance(CrearUsuarioDto, {
      correo: 'n@unipacifico.edu.co', nombre: 'N', password: 'Clave1234', semestre: 1, rol: 'ADMIN',
    });
    expect((await errores(sinId)).join()).toMatch(/número de identificación es obligatorio/);
  });
});
