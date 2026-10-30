import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';

describe('MailService (modo simulación vs SMTP)', () => {
  test('sin SMTP_HOST → simulación: no envía y reporta conteo sin loguear PII', async () => {
    const svc = new MailService(new ConfigService({}));
    const logger = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    expect(svc.simulacion).toBe(true);
    const r = await svc.enviar(['a@u.edu.co', 'b@u.edu.co'], 'Hola', '<p>Ana Pérez</p>');
    expect(r).toEqual({ simulado: true, destinatarios: 2 });
    const log = JSON.stringify(logger.mock.calls);
    expect(log).not.toContain('a@u.edu.co');
    expect(log).not.toContain('Ana Pérez');
    expect(log).not.toContain('<p>');
    logger.mockRestore();
  });

  test('con SMTP_HOST → crea transporte y envía en lotes (sin red real)', async () => {
    const svc = new MailService(
      new ConfigService({ SMTP_HOST: 'smtp.test', SMTP_PORT: '587', SMTP_USER: 'u', SMTP_PASSWORD: 'p', MAIL_FROM: 't@test.co' }),
    );
    expect(svc.simulacion).toBe(false);
    const transporter = (svc as unknown as { transporter: { sendMail: jest.Mock } }).transporter;
    transporter.sendMail = jest.fn().mockResolvedValue({});
    // 120 destinatarios → 3 lotes de 50/50/20 por BCC
    const r = await svc.enviar(Array.from({ length: 120 }, (_, i) => `e${i}@u.edu.co`), 'Aviso', '<p>hola</p>');
    expect(r).toEqual({ simulado: false, destinatarios: 120 });
    expect(transporter.sendMail).toHaveBeenCalledTimes(3);
    expect(transporter.sendMail.mock.calls[2][0].bcc).toHaveLength(20);
    expect(transporter.sendMail.mock.calls[0][0]).toMatchObject({ from: 't@test.co', subject: 'Aviso' });
  });
});
