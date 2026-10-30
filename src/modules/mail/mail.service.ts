import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter | null = null;

  constructor(private config: ConfigService) {
    const host = this.config.get('SMTP_HOST');
    if (host) {
      this.transporter = nodemailer.createTransport({
        host,
        port: Number(this.config.get('SMTP_PORT', 587)),
        secure: false,
        auth: this.config.get('SMTP_USER')
          ? { user: this.config.get('SMTP_USER'), pass: this.config.get('SMTP_PASSWORD') }
          : undefined,
      });
    }
  }

  get simulacion() {
    return !this.transporter;
  }

  async enviar(para: string[], asunto: string, html: string) {
    if (!this.transporter) {
      // eslint-disable-next-line no-console
      console.log(`[MAIL simulación] ${para.length} destinatarios | Asunto: ${asunto}`);
      return { simulado: true, destinatarios: para.length };
    }
    const from = this.config.get('MAIL_FROM', 'no-reply@unipacifico.edu.co');
    // Enviar en lotes para no saturar
    for (let i = 0; i < para.length; i += 50) {
      const lote = para.slice(i, i + 50);
      await this.transporter.sendMail({ from, bcc: lote, subject: asunto, html });
    }
    return { simulado: false, destinatarios: para.length };
  }
}
