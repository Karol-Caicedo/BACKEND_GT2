import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface ResendResultado {
  simulado: boolean;
  id?: string;
}

/** Escapa texto de usuario para interpolarlo en el HTML sin romperlo. */
export function escaparHtml(texto: string): string {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Plantilla del correo de recuperación con la identidad de la app
 * (azul #1976B9 / #0B3A5E + verde #39864A). Tablas y estilos en línea
 * para compatibilidad con clientes de correo (Gmail, Outlook, etc.).
 */
export function plantillaRecuperacion(nombre: string, codigo: string, url: string): { asunto: string; html: string; texto: string } {
  const asunto = 'Recupera tu contraseña · SIGICE';
  const nombreSeguro = escaparHtml(nombre);
  const codigoSeguro = escaparHtml(codigo);
  const urlSegura = escaparHtml(url);
  const html = `<!doctype html>
<html lang="es">
<body style="margin:0;padding:0;background-color:#F0F7FC;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Usa el código para restablecer tu contraseña de SIGICE. Vence en 1 hora.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F0F7FC;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#FFFFFF;border-radius:12px;overflow:hidden;border:1px solid #DCEBF6;">
        <tr><td style="background-color:#0B3A5E;padding:28px 32px;text-align:center;">
          <p style="margin:0;color:#FFFFFF;font-family:Arial,Helvetica,sans-serif;font-size:24px;font-weight:bold;">SIGICE</p>
          <p style="margin:6px 0 0;color:#DCEBF6;font-family:Arial,Helvetica,sans-serif;font-size:13px;">Ingeniería de Sistemas · Proyección Social</p>
        </td></tr>
        <tr><td style="height:4px;background-color:#39864A;line-height:4px;">&nbsp;</td></tr>
        <tr><td style="padding:32px;">
          <p style="margin:0 0 12px;font-family:Arial,Helvetica,sans-serif;font-size:16px;color:#1F2933;">Hola ${nombreSeguro},</p>
          <p style="margin:0 0 12px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1F2933;">
            Recibimos una solicitud para restablecer tu contraseña de <strong>SIGICE</strong>.
            Si no fuiste tú, ignora este mensaje: tu clave sigue intacta.
          </p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
            <tr><td align="center" style="background-color:#1976B9;border-radius:8px;">
              <a href="${urlSegura}" style="display:inline-block;padding:14px 32px;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;color:#FFFFFF;text-decoration:none;">Abrir restablecimiento</a>
            </td></tr>
          </table>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F0F7FC;border:1px solid #DCEBF6;border-radius:8px;">
            <tr><td style="padding:12px 16px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:#52606D;">
              ⏱ Este código <strong>vence en 1 hora</strong> y solo puede usarse <strong>una vez</strong>.<br />
              Ingresa este código en la pantalla de restablecimiento:<br />
              <strong style="display:block;margin-top:12px;font-size:18px;letter-spacing:2px;color:#0B3A5E;word-break:break-all;">${codigoSeguro}</strong>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:20px 32px;text-align:center;border-top:1px solid #DCEBF6;">
          <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#52606D;">Universidad del Pacífico · Buenaventura — Proyección Social</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  const texto = `Hola ${nombre},\n\nRecibimos una solicitud para restablecer tu contraseña de SIGICE. Si no fuiste tú, ignora este mensaje.\n\nAbre ${url} e ingresa este código (vence en 1 hora, un solo uso):\n${codigo}\n\nUniversidad del Pacífico · Proyección Social`;
  return { asunto, html, texto };
}

/**
 * Envío transaccional con Resend (https://resend.com).
 * Sin RESEND_API_KEY opera en simulación (log) para no romper desarrollo.
 * OJO: el remitente debe ser un dominio verificado en Resend; con la API en
 * modo prueba solo llega correo al propietario de la cuenta.
 */
@Injectable()
export class ResendService {
  private readonly log = new Logger(ResendService.name);
  private readonly apiKey: string;
  readonly remitente: string;

  constructor(private config: ConfigService) {
    this.apiKey = (this.config.get('RESEND_API_KEY', '') as string).trim();
    this.remitente =
      (this.config.get('RESEND_FROM', '') as string).trim() ||
      (this.config.get('MAIL_FROM', 'no-reply@unipacifico.edu.co') as string);
  }

  get simulacion() {
    return !this.apiKey;
  }

  async enviarRecuperacion(para: string, nombre: string, codigo: string, url: string): Promise<ResendResultado> {
    const { asunto, html, texto } = plantillaRecuperacion(nombre, codigo, url);
    if (!this.apiKey) {
      this.log.log('[Resend simulación] Correo de recuperación omitido del log (sin RESEND_API_KEY)');
      return { simulado: true };
    }
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: this.remitente, to: [para], subject: asunto, html, text: texto }),
    });
    if (!res.ok) {
      this.log.error(`Resend respondió ${res.status}`);
      throw new Error(`No se pudo enviar el correo de recuperación (Resend ${res.status})`);
    }
    const cuerpo = (await res.json().catch(() => ({}))) as { id?: string };
    return { simulado: false, id: cuerpo.id };
  }
}
