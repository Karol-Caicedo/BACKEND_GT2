import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Capacitacion } from '../capacitaciones/capacitacion.entity';
import { CapacitacionesModule } from '../capacitaciones/capacitaciones.module';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

@Module({
  imports: [TypeOrmModule.forFeature([Capacitacion]), CapacitacionesModule],
  controllers: [UploadsController],
  providers: [UploadsService],
})
export class UploadsModule {}
