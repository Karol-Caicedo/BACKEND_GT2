import 'reflect-metadata';
import AppDataSource from '../data-source';
import { hashPassword } from '../common/password.util';
import { CLAVES_DEMO } from '../seed-policy';
import { Rol, User } from '../modules/users/user.entity';

type Cuenta = {
  etiqueta: string;
  correo: string;
  password: string | undefined;
  nombre: string;
  semestre: number;
  rol: Rol;
};

type Resultado = {
  cuenta: string;
  accion: string;
  rol: string;
  sesionesInvalidadas: boolean;
};

class CuentaFaltante extends Error {}

function validarClave(etiqueta: string, valor: string | undefined): string {
  if (!valor || valor.length < 8) {
    throw new Error(`${etiqueta}: define una contraseña de al menos 8 caracteres.`);
  }
  if (CLAVES_DEMO.has(valor)) {
    throw new Error(`${etiqueta}: no se permite una contraseña de demostración.`);
  }
  return valor;
}

function cuentas(): Cuenta[] {
  const semestre = Number(process.env.ESTUDIANTE_SEMESTRE || 5);
  if (!Number.isInteger(semestre) || semestre < 1 || semestre > 9) {
    throw new Error('ESTUDIANTE_SEMESTRE debe ser un entero entre 1 y 9.');
  }

  return [
    {
      etiqueta: 'ADMIN',
      correo: (process.env.ADMIN_EMAIL || 'admin@unipacifico.edu.co').trim().toLowerCase(),
      password: process.env.ADMIN_NEW_PASSWORD,
      nombre: process.env.ADMIN_NOMBRE || 'Proyección Social',
      semestre: 1,
      rol: 'ADMIN',
    },
    {
      etiqueta: 'ESTUDIANTE',
      correo: (process.env.ESTUDIANTE_EMAIL || 'estudiante@unipacifico.edu.co').trim().toLowerCase(),
      password: process.env.ESTUDIANTE_NEW_PASSWORD,
      nombre: process.env.ESTUDIANTE_NOMBRE || 'Estudiante Demo',
      semestre,
      rol: 'ESTUDIANTE',
    },
  ];
}

async function main() {
  if (process.env.RESET_PASSWORDS_CONFIRM !== 'YES') {
    throw new Error('Confirma la operación con RESET_PASSWORDS_CONFIRM=YES.');
  }

  const dryRun = process.argv.includes('--dry-run');
  const crearFaltantes = process.argv.includes('--create-missing');
  const lista = cuentas();

  for (const cuenta of lista) {
    cuenta.password = validarClave(cuenta.etiqueta, cuenta.password);
  }

  await AppDataSource.initialize();
  try {
    console.log(
      `Destino: ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'intereses_db'}`,
    );
    const resultados = await AppDataSource.transaction(async (manager) => {
      const repo = manager.getRepository(User);
      const salida: Resultado[] = [];

      for (const cuenta of lista) {
        const existente = await repo.findOne({ where: { correo: cuenta.correo } });

        if (!existente && !crearFaltantes) {
          throw new CuentaFaltante(
            `No existe la cuenta etiquetada como ${cuenta.etiqueta}. Usa --create-missing si quieres crearla.`,
          );
        }

        if (dryRun) {
          salida.push({
            cuenta: cuenta.etiqueta,
            accion: existente ? 'actualizaría' : 'crearía',
            rol: existente?.rol ?? cuenta.rol,
            sesionesInvalidadas: !!existente,
          });
          continue;
        }

        if (existente) {
          existente.passwordHash = await hashPassword(cuenta.password!);
          existente.tokenVersion = (existente.tokenVersion ?? 0) + 1;
          if (existente.proveedorAuth !== 'local') existente.proveedorAuth = 'local';
          await repo.save(existente);
          salida.push({
            cuenta: cuenta.etiqueta,
            accion: 'actualizada',
            rol: existente.rol,
            sesionesInvalidadas: true,
          });
          continue;
        }

        const creado = repo.create({
          correo: cuenta.correo,
          nombre: cuenta.nombre,
          passwordHash: await hashPassword(cuenta.password!),
          proveedorAuth: 'local',
          semestre: cuenta.semestre,
          rol: cuenta.rol,
          aceptoDatosAt: new Date(),
          tokenVersion: 0,
        });
        await repo.save(creado);
        salida.push({
          cuenta: cuenta.etiqueta,
          accion: 'creada',
          rol: creado.rol,
          sesionesInvalidadas: false,
        });
      }

      return salida;
    });

    console.log(`${dryRun ? 'Simulación' : 'Resultado'}:`);
    console.table(resultados);
    if (dryRun) console.log('No se escribió nada. Ejecuta sin --dry-run para aplicar.');
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
