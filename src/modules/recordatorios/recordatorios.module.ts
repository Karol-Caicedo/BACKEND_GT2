import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RecordatorioEnviado } from './recordatorio.entity';
import { Periodo } from '../periodos/periodo.entity';
import { User } from '../users/user.entity';
import { Respuesta } from '../encuestas/respuesta.entity';
import { RecordatoriosService } from './recordatorios.service';
import { RecordatoriosController } from './recordatorios.controller';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [TypeOrmModule.forFeature([RecordatorioEnviado, Periodo, User, Respuesta]), MailModule],
  controllers: [RecordatoriosController],
  providers: [RecordatoriosService],
  exports: [RecordatoriosService],
})
export class RecordatoriosModule {}
