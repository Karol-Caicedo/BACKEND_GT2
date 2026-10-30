import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { existsSync } from 'fs';
import { join } from 'path';
import type { Response } from 'express';
import { In, Repository } from 'typeorm';
import { Capacitacion } from '../capacitaciones/capacitacion.entity';
import { CapacitacionViewer, CapacitacionesService } from '../capacitaciones/capacitaciones.service';

const NOMBRE_VALIDO = /^[a-f0-9]{32}\.(jpg|png|webp)$/;

@Injectable()
export class UploadsService {
  constructor(
    private readonly config: ConfigService,
    private readonly capacitaciones: CapacitacionesService,
    @InjectRepository(Capacitacion) private readonly cap: Repository<Capacitacion>,
  ) {}

  async enviar(nombre: string, viewer: CapacitacionViewer, res: Response): Promise<void> {
    if (!NOMBRE_VALIDO.test(nombre)) throw new NotFoundException('Imagen no encontrada');

    const cap = await this.cap.findOne({
      where: { imagenUrl: In([`/api/uploads/${nombre}`, `/uploads/${nombre}`]) },
      relations: ['semestres'],
    });
    if (!cap || !(await this.capacitaciones.puedeVer(cap, viewer))) {
      throw new NotFoundException('Imagen no encontrada');
    }

    const configurado = this.config.get<string>('UPLOADS_DIR', './uploads');
    const dir = configurado.startsWith('/') ? configurado : join(process.cwd(), configurado);
    const archivo = join(dir, nombre);
    if (!existsSync(archivo)) throw new NotFoundException('Imagen no encontrada');

    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Disposition', `inline; filename="${nombre}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.type(nombre);

    await new Promise<void>((resolve, reject) => {
      res.sendFile(archivo, { dotfiles: 'deny', cacheControl: false }, (err) => {
        if (!err) return resolve();
        if (res.headersSent) {
          res.end();
          return resolve();
        }
        reject(new NotFoundException('Imagen no encontrada'));
      });
    });
  }
}
