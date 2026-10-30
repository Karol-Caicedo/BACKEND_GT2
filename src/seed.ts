import 'reflect-metadata';
import { hashPassword } from './common/password.util';
import AppDataSource from './data-source';
import { User } from './modules/users/user.entity';
import { Tema } from './modules/temas/tema.entity';
import { Asignatura } from './modules/asignaturas/asignatura.entity';
import { GrupoAsignatura } from './modules/asignaturas/grupo-asignatura.entity';
import { debeCrearEstudianteDemo, esProduccion, validarClaveProduccion } from './seed-policy';


export const TEMAS_INICIALES = [
  ['IA generativa y prompt engineering', 'Modelos generativos, prompting y aplicaciones'],
  ['Machine learning y ciencia de datos', 'Algoritmos, modelos predictivos y análisis de datos'],
  ['Ciberseguridad y hacking ético', 'Seguridad ofensiva/defensiva y buenas prácticas'],
  ['Computación en la nube', 'AWS, Azure, GCP y arquitecturas cloud'],
  ['DevOps y automatización', 'CI/CD, contenedores e infraestructura como código'],
  ['Desarrollo web full stack', 'Frontend, backend y APIs modernas'],
  ['Desarrollo de apps móviles', 'Android, iOS, Flutter y React Native'],
  ['IoT y sistemas embebidos', 'Sensores, microcontroladores y edge computing'],
  ['Big data y analítica de negocios', 'Pipelines de datos y BI'],
  ['Blockchain y finanzas digitales', 'Contratos inteligentes y criptoactivos'],
  ['Realidad virtual y aumentada', 'Experiencias inmersivas y 3D'],
  ['Desarrollo de videojuegos', 'Motores, diseño y programación de juegos'],
  ['Robótica', 'Automatización física y control'],
  ['Diseño UX/UI', 'Experiencia de usuario e interfaces'],
  ['Pruebas de software y QA', 'Testing manual y automatizado'],
  ['Low-code/No-code y RPA', 'Automatización de procesos sin código'],
  ['Metodologías ágiles y gestión de proyectos TI', 'Scrum, Kanban y liderazgo técnico'],
  ['Emprendimiento tecnológico', 'Startups, modelo de negocio y pitch'],
  ['Certificaciones internacionales', 'Preparación para certificaciones de la industria'],
  ['Inglés técnico', 'Inglés aplicado a tecnología y empleabilidad'],
];

export const ASIGNATURAS_INICIALES: { nombre: string; semestre: number }[] = [
  { nombre: 'Cálculo Diferencial', semestre: 1 },
  { nombre: 'Álgebra Lineal', semestre: 1 },
  { nombre: 'Fundamentos de Programación', semestre: 1 },
  { nombre: 'Introducción a la Ingeniería de Sistemas', semestre: 1 },
  { nombre: 'Cálculo Integral', semestre: 2 },
  { nombre: 'Física Mecánica', semestre: 2 },
  { nombre: 'Programación Orientada a Objetos', semestre: 2 },
  { nombre: 'Matemáticas Discretas', semestre: 2 },
  { nombre: 'Cálculo Multivariable', semestre: 3 },
  { nombre: 'Física Electromagnetismo', semestre: 3 },
  { nombre: 'Estructuras de Datos', semestre: 3 },
  { nombre: 'Arquitectura de Computadores', semestre: 3 },
  { nombre: 'Análisis de Algoritmos', semestre: 4 },
  { nombre: 'Bases de Datos I', semestre: 4 },
  { nombre: 'Sistemas Operativos', semestre: 4 },
  { nombre: 'Redes de Computadores I', semestre: 4 },
  { nombre: 'Bases de Datos II', semestre: 5 },
  { nombre: 'Ingeniería de Software I', semestre: 5 },
  { nombre: 'Redes de Computadores II', semestre: 5 },
  { nombre: 'Desarrollo Web', semestre: 5 },
  { nombre: 'Ingeniería de Software II', semestre: 6 },
  { nombre: 'Inteligencia Artificial', semestre: 6 },
  { nombre: 'Seguridad Informática', semestre: 6 },
  { nombre: 'Computación en la Nube', semestre: 6 },
  { nombre: 'Arquitectura de Software', semestre: 7 },
  { nombre: 'Desarrollo Móvil', semestre: 7 },
  { nombre: 'Big Data y Analítica', semestre: 7 },
  { nombre: 'Gestión de Proyectos TI', semestre: 7 },
  { nombre: 'Calidad y Pruebas de Software', semestre: 8 },
  { nombre: 'Auditoría de Sistemas', semestre: 8 },
  { nombre: 'Trabajo de Grado I', semestre: 8 },
  { nombre: 'Práctica Profesional', semestre: 8 },
  { nombre: 'Trabajo de Grado II', semestre: 9 },
  { nombre: 'Emprendimiento e Innovación TI', semestre: 9 },
  { nombre: 'Legislación y Ética en TI', semestre: 9 },
  { nombre: 'Seminario de Nuevas Tecnologías', semestre: 9 },
];

async function main() {
  await AppDataSource.initialize();
  const users = AppDataSource.getRepository(User);
  const temas = AppDataSource.getRepository(Tema);
  const produccion = esProduccion();

  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@unipacifico.edu.co').toLowerCase();
  let admin = await users.findOne({ where: { correo: adminEmail } });
  const baseYaInicializada = !!admin;
  if (!admin) {
    const adminPass = produccion
      ? validarClaveProduccion('ADMIN_PASSWORD', process.env.ADMIN_PASSWORD)
      : process.env.ADMIN_PASSWORD || 'C0{ABX3Yk4qxs';
    admin = await users.save(
      users.create({
        correo: adminEmail,
        nombre: process.env.ADMIN_NOMBRE || 'Proyección Social',
        passwordHash: await hashPassword(adminPass),
        proveedorAuth: 'local',
        semestre: 1,
        rol: 'ADMIN',
        aceptoDatosAt: new Date(),
      }),
    );
    // eslint-disable-next-line no-console
    console.log('Admin creado.');
  } else {
    // eslint-disable-next-line no-console
    console.log('Admin ya existe.');
  }

  const crearDemo = debeCrearEstudianteDemo(produccion, process.env.SEED_DEMO_STUDENT);
  if (crearDemo) {
    const estEmail = (process.env.ESTUDIANTE_EMAIL || 'estudiante@unipacifico.edu.co').toLowerCase();
    const estPass = produccion
      ? validarClaveProduccion('ESTUDIANTE_PASSWORD', process.env.ESTUDIANTE_PASSWORD)
      : process.env.ESTUDIANTE_PASSWORD || 'Estudiante123*';
    const estSemestre = Math.min(9, Math.max(1, Number(process.env.ESTUDIANTE_SEMESTRE || 5)));
    const existeEst = await users.findOne({ where: { correo: estEmail } });
    if (!existeEst) {
      await users.save(
        users.create({
          correo: estEmail,
          nombre: process.env.ESTUDIANTE_NOMBRE || 'Estudiante Demo',
          passwordHash: await hashPassword(estPass),
          proveedorAuth: 'local',
          semestre: estSemestre,
          rol: 'ESTUDIANTE',
          aceptoDatosAt: new Date(),
        }),
      );
      // eslint-disable-next-line no-console
      console.log(`Estudiante demo creado (semestre ${estSemestre}).`);
    } else {
      // eslint-disable-next-line no-console
      console.log('Estudiante demo ya existe.');
    }
  } else {
    // eslint-disable-next-line no-console
    console.log('Seed de producción: estudiante demo omitido (SEED_DEMO_STUDENT=false).');
  }

  if (!baseYaInicializada) {
    for (const [nombre, descripcion] of TEMAS_INICIALES) {
      const existe = await temas.findOne({ where: { nombre } });
      if (!existe) await temas.save(temas.create({ nombre, descripcion, activo: true }));
    }
    // eslint-disable-next-line no-console
    console.log(`Temas iniciales creados: ${TEMAS_INICIALES.length}`);
  } else {
    // eslint-disable-next-line no-console
    console.log('Base de datos ya inicializada: respetando temas eliminados por el administrador.');
  }

  const asignaturasRepo = AppDataSource.getRepository(Asignatura);
  const gruposRepo = AppDataSource.getRepository(GrupoAsignatura);
  const totalAsignaturas = await asignaturasRepo.count();
  if (totalAsignaturas === 0) {
    for (const item of ASIGNATURAS_INICIALES) {
      await asignaturasRepo.save(asignaturasRepo.create({ ...item, activo: true }));
    }
    // eslint-disable-next-line no-console
    console.log(`Asignaturas iniciales creadas: ${ASIGNATURAS_INICIALES.length}`);
  }

  const totalGrupos = await gruposRepo.count();
  if (totalGrupos === 0) {
    const calculo = await asignaturasRepo.findOne({ where: { nombre: 'Cálculo Diferencial' } });
    if (calculo) {
      await gruposRepo.save([
        gruposRepo.create({
          asignaturaId: calculo.id,
          profesor: 'Prof. Lucio Pérez',
          codigoGrupo: 'Grupo D1',
          horario: 'Lunes 8:00 - 10:00 AM y Jueves 9:00 - 11:00 AM',
          activo: true,
        }),
        gruposRepo.create({
          asignaturaId: calculo.id,
          profesor: 'Prof. Lucio Pérez',
          codigoGrupo: 'Grupo D2',
          horario: 'Martes 8:00 - 10:00 AM y Viernes 10:00 - 12:00 PM',
          activo: true,
        }),
        gruposRepo.create({
          asignaturaId: calculo.id,
          profesor: 'Prof. Carmen Rivas',
          codigoGrupo: 'Grupo D3',
          horario: 'Miércoles 2:00 - 4:00 PM y Viernes 2:00 - 4:00 PM',
          activo: true,
        }),
      ]);
    }

    const prog = await asignaturasRepo.findOne({ where: { nombre: 'Fundamentos de Programación' } });
    if (prog) {
      await gruposRepo.save([
        gruposRepo.create({
          asignaturaId: prog.id,
          profesor: 'Prof. Andrés Gómez',
          codigoGrupo: 'Grupo P1',
          horario: 'Lunes 10:00 - 12:00 PM y Miércoles 10:00 - 12:00 PM',
          activo: true,
        }),
        gruposRepo.create({
          asignaturaId: prog.id,
          profesor: 'Prof. Elena Morales',
          codigoGrupo: 'Grupo P2',
          horario: 'Martes 2:00 - 4:00 PM y Jueves 2:00 - 4:00 PM',
          activo: true,
        }),
      ]);
    }
    // eslint-disable-next-line no-console
    console.log('Grupos de asignaturas iniciales creados.');
  }


  await AppDataSource.destroy();
  process.exit(0);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
