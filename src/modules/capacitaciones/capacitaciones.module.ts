import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Capacitacion, CapacitacionSemestre } from './capacitacion.entity';
import { ClicCapacitacion } from './clic.entity';
import { CapacitacionesService } from './capacitaciones.service';
import { CapacitacionesController } from './capacitaciones.controller';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [TypeOrmModule.forFeature([Capacitacion, CapacitacionSemestre, ClicCapacitacion]), MailModule],
  controllers: [CapacitacionesController],
  providers: [CapacitacionesService],
  exports: [CapacitacionesService],
})
export class CapacitacionesModule {}
