export const CLAVES_DEMO = new Set(['Admin123*', 'Estudiante123*', 'C0{ABX3Yk4qxs']);

export function esProduccion(
  argv: string[] = process.argv,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): boolean {
  return argv.includes('--prod') || nodeEnv === 'production';
}

export function validarClaveProduccion(nombre: string, valor: string | undefined): string {
  const clave = (valor || '').trim();
  if (clave.length < 8) {
    throw new Error(`${nombre} es obligatorio en producción y debe tener al menos 8 caracteres.`);
  }
  if (CLAVES_DEMO.has(clave)) {
    throw new Error(`${nombre} no puede usar una clave de demostración en producción.`);
  }
  return clave;
}

export function debeCrearEstudianteDemo(
  produccion: boolean,
  habilitado: string | undefined,
): boolean {
  return !produccion || habilitado === 'true';
}
