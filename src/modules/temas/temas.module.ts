import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tema } from './tema.entity';
import { TemasService } from './temas.service';
import { TemasController } from './temas.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Tema])],
  controllers: [TemasController],
  providers: [TemasService],
  exports: [TemasService],
})
export class TemasModule {}
