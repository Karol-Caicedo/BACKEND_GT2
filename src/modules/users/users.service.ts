import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private repo: Repository<User>) {}

  findByCorreo(correo: string) {
    return this.repo.findOne({ where: { correo: correo.toLowerCase() } });
  }
  findById(id: string) {
    return this.repo.findOne({ where: { id } });
  }
  findAll() {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }
  create(data: Partial<User>) {
    const u = this.repo.create({ ...data, correo: data.correo!.toLowerCase() });
    return this.repo.save(u);
  }
  save(u: User) {
    return this.repo.save(u);
  }
  countBySemestre(semestre?: number) {
    const qb = this.repo.createQueryBuilder('u').where('u.rol = :r', { r: 'ESTUDIANTE' });
    if (semestre) qb.andWhere('u.semestre = :s', { s: semestre });
    return qb.getCount();
  }
  async remove(id: string) {
    const u = await this.findById(id);
    if (!u) return false;
    await this.repo.remove(u);
    return true;
  }
}
