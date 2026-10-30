import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { User } from './modules/users/user.entity';
import { Periodo } from './modules/periodos/periodo.entity';
import { Tema } from './modules/temas/tema.entity';
import { Respuesta, RespuestaTema } from './modules/encuestas/respuesta.entity';
import { Capacitacion, CapacitacionSemestre } from './modules/capacitaciones/capacitacion.entity';
import { ClicCapacitacion } from './modules/capacitaciones/clic.entity';
import { RecordatorioEnviado } from './modules/recordatorios/recordatorio.entity';
import { PasswordReset } from './modules/auth/password-reset.entity';
import { SsoCode } from './modules/auth/sso-code.entity';
import { LoginChallenge } from './modules/auth/login-challenge.entity';
import { Asignatura } from './modules/asignaturas/asignatura.entity';
import { GrupoAsignatura } from './modules/asignaturas/grupo-asignatura.entity';
import { RespuestaAsignatura, RespuestaAsignaturaItem } from './modules/encuestas-asignaturas/respuesta-asignatura.entity';
import { InscripcionAsignatura } from './modules/encuestas-asignaturas/inscripcion-asignatura.entity';
import { Init1700000000000 } from './migrations/1700000000000-init';
import { RecuperacionClaves1700000000001 } from './migrations/1700000000001-recuperacion-claves';
import { PasswordPlano1700000000002 } from './migrations/1700000000002-password-plano';
import { DropSugerencias1700000000003 } from './migrations/1700000000003-drop-sugerencias';
import { AsignaturasYEncuestas1700000000004 } from './migrations/1700000000004-asignaturas-y-encuestas';
import { ResetRespuestas1700000000005 } from './migrations/1700000000005-reset-respuestas';
import { InscripcionesMaterias1700000000006 } from './migrations/1700000000006-inscripciones-materias';
import { EliminarPasswordPlanoYRevocarSesiones1700000000007 } from './migrations/1700000000007-eliminar-password-plano';
import { NormalizarUrlsImagen1700000000008 } from './migrations/1700000000008-normalizar-urls-imagen';
import { SsoCodes1700000000009 } from './migrations/1700000000009-sso-codes';
import { PeriodoActivoUnico1700000000010 } from './migrations/1700000000010-periodo-activo-unico';
import { LoginCryptoChallenges1700000000011 } from './migrations/1700000000011-login-crypto-challenges';
import { GruposAsignaturas1700000000012 } from './migrations/1700000000012-grupos-asignaturas';

dotenv.config({ path: '../.env' });
dotenv.config();

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'intereses_db',
  entities: [User, Periodo, Tema, Respuesta, RespuestaTema, Capacitacion, CapacitacionSemestre, ClicCapacitacion, RecordatorioEnviado, PasswordReset, SsoCode, LoginChallenge, Asignatura, GrupoAsignatura, RespuestaAsignatura, RespuestaAsignaturaItem, InscripcionAsignatura],
  migrations: [Init1700000000000, RecuperacionClaves1700000000001, PasswordPlano1700000000002, DropSugerencias1700000000003, AsignaturasYEncuestas1700000000004, ResetRespuestas1700000000005, InscripcionesMaterias1700000000006, EliminarPasswordPlanoYRevocarSesiones1700000000007, NormalizarUrlsImagen1700000000008, SsoCodes1700000000009, PeriodoActivoUnico1700000000010, LoginCryptoChallenges1700000000011, GruposAsignaturas1700000000012],
  synchronize: false,
});


export default AppDataSource;
