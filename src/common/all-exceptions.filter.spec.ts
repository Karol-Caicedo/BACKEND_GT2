import { ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

function crearHost(req: Record<string, unknown> = {}) {
  const json = jest.fn();
  const res = {
    headersSent: false,
    status: jest.fn().mockReturnValue({ json }),
  };
  const request = {
    originalUrl: '/api/auth/login?token=abc',
    method: 'POST',
    correlationId: 'corr-1',
    ip: '127.0.0.1',
    ...req,
  };
  const host = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => res,
    }),
  } as ArgumentsHost;
  return { host, json, res };
}

describe('AllExceptionsFilter', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('las respuestas de error no incluyen stack ni secretos del cliente', () => {
    const { host, json } = crearHost();
    const filter = new AllExceptionsFilter();
    filter.catch(new HttpException('password=ClaveSecreta', HttpStatus.BAD_REQUEST), host);
    expect(json).toHaveBeenCalledWith({
      statusCode: 400,
      error: 'Bad Request',
      message: 'Solicitud inválida',
      correlationId: 'corr-1',
    });
    expect(JSON.stringify(json.mock.calls[0][0])).not.toContain('ClaveSecreta');
  });

  test('un 500 registra el error redactado y no lo devuelve al cliente', () => {
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { host, json } = crearHost();
    const filter = new AllExceptionsFilter();
    const boom = new Error('fallo password=ClaveSecreta token=abc.def');
    boom.stack = 'Error: fallo password=ClaveSecreta\n    at Query';
    filter.catch(boom, host);

    const cuerpo = json.mock.calls[0][0] as Record<string, unknown>;
    expect(cuerpo).toMatchObject({ statusCode: 500, message: 'Error interno' });
    expect(JSON.stringify(cuerpo)).not.toContain('ClaveSecreta');

    const log = String(error.mock.calls[0][0]);
    const stack = String(error.mock.calls[0][1] ?? '');
    expect(log).toContain('http_error');
    expect(log + stack).not.toContain('ClaveSecreta');
    expect(log + stack).not.toContain('abc.def');
  });

  test('un 401 registra método, ruta y correlation ID sin registrar secretos ni query', () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const { host, json } = crearHost();
    const filter = new AllExceptionsFilter();
    filter.catch(new HttpException('Credenciales inválidas', HttpStatus.UNAUTHORIZED), host);

    expect(json).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 401,
      message: 'No autenticado',
      correlationId: 'corr-1',
    }));
    expect(warn).toHaveBeenCalledWith(JSON.stringify({
      event: 'http_unauthorized',
      status: 401,
      method: 'POST',
      path: '/api/auth/login',
      correlationId: 'corr-1',
    }));
    expect(String(warn.mock.calls[0][0])).not.toContain('token=abc');
    expect(String(warn.mock.calls[0][0])).not.toContain('Credenciales');
  });
});
