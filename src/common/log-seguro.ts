/** Campos que no deben aparecer con su valor en logs. */
const PATRON_SECRETO =
  /(["']?(?:password|passwd|pwd|passwordHash|passwordPlano|access_token|refresh_token|authorization|cookie|secret|api[_-]?key|bearer|token)["']?\s*[=:]\s*)("?)[^,\s"'\\]+/gi;

export function redactarTexto(texto: string): string {
  return String(texto ?? '')
    .replace(/\bBearer\s+\S+/gi, 'Bearer [redactado]')
    .replace(PATRON_SECRETO, '$1$2[redactado]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[correo redactado]');
}

export function detalleErrorParaLog(exception: unknown): { message: string; stack?: string } {
  if (!(exception instanceof Error)) {
    return { message: 'Error no serializable' };
  }
  const message = redactarTexto(`${exception.name}: ${exception.message}`);
  const stack = exception.stack ? redactarTexto(exception.stack) : undefined;
  return { message, stack };
}
