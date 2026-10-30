import { ConfigService } from '@nestjs/config';
import { ResendService, plantillaRecuperacion, escaparHtml } from './resend.service';

const URL = 'http://localhost:4200/auth/restablecer';
const CODIGO = 'codigo-de-prueba-no-secreto';

describe('plantillaRecuperacion (identidad de la app)', () => {
  test('usa los colores institucionales, un enlace limpio y un código separado', () => {
    const { asunto, html, texto } = plantillaRecuperacion('Ana', CODIGO, URL);
    expect(asunto).toContain('SIGICE');
    for (const color of ['#0B3A5E', '#1976B9', '#39864A', '#DCEBF6', '#F0F7FC', '#1F2933', '#52606D']) {
      expect(html).toContain(color);
    }
    expect(html).toContain(`href="${URL}"`);
    expect(html).toContain('Abrir restablecimiento');
    expect(html).toContain('vence en 1 hora');
    expect(html).toContain(CODIGO);
    expect(html).not.toContain('token=');
    expect(html).not.toContain(`${URL}?`);
    expect(texto).toContain(URL);
    expect(texto).toContain(CODIGO);
    expect(texto).not.toContain('token=');
  });

  test('escapa el nombre para no romper el HTML', () => {
    expect(escaparHtml('<b>Ana & "Luis"</b>')).toBe('&lt;b&gt;Ana &amp; &quot;Luis&quot;&lt;/b&gt;');
    const { html } = plantillaRecuperacion('<script>alert(1)</script>', CODIGO, URL);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('ResendService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  test('sin API key → simulación sin red', async () => {
    const loggerLog = jest.spyOn(require('@nestjs/common').Logger.prototype, 'log').mockImplementation(() => undefined);
    const svc = new ResendService(new ConfigService({}));
    expect(svc.simulacion).toBe(true);
    await expect(svc.enviarRecuperacion('a@gmail.com', 'Ana', CODIGO, URL)).resolves.toEqual({ simulado: true });
    expect(loggerLog).toHaveBeenCalled();
    const log = JSON.stringify(loggerLog.mock.calls);
    expect(log).not.toContain(CODIGO);
    expect(log).not.toContain('a@gmail.com');
  });

  test('con API key → POST a Resend con html+text y retorna el id', async () => {
    const svc = new ResendService(new ConfigService({ RESEND_API_KEY: 're_test', RESEND_FROM: 'SIGICE <onboarding@resend.dev>' }));
    expect(svc.simulacion).toBe(false);
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'mail-1' }) });
    global.fetch = fetchMock as never;
    await expect(svc.enviarRecuperacion('a@gmail.com', 'Ana', CODIGO, URL)).resolves.toEqual({ simulado: false, id: 'mail-1' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [endpoint, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(endpoint).toBe('https://api.resend.com/emails');
    const cuerpo = JSON.parse(opts.body as string);
    expect(cuerpo).toMatchObject({ from: 'SIGICE <onboarding@resend.dev>', subject: expect.stringContaining('SIGICE') });
    expect(cuerpo.to).toEqual(['a@gmail.com']);
    expect(cuerpo.html).toContain('#1976B9');
    expect(cuerpo.text).toContain(URL);
    expect(cuerpo.text).toContain(CODIGO);
    expect(cuerpo.text).not.toContain('token=');
  });

  test('error de Resend → lanza con el estado', async () => {
    const svc = new ResendService(new ConfigService({ RESEND_API_KEY: 're_test' }));
    const loggerError = jest.spyOn(require('@nestjs/common').Logger.prototype, 'error').mockImplementation(() => undefined);
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 403, text: async () => 'dominio no verificado' }) as never;
    await expect(svc.enviarRecuperacion('a@gmail.com', 'Ana', CODIGO, URL)).rejects.toThrow(/Resend 403/);
    expect(loggerError).toHaveBeenCalled();
    expect(JSON.stringify(loggerError.mock.calls)).not.toContain('dominio no verificado');
  });
});
