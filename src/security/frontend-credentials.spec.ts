import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const FRONTEND_SRC = join(__dirname, '..', '..', '..', 'frontend', 'src');
const PATRON_CREDENCIAL_EN_LOCALSTORAGE =
  /localStorage\s*\.\s*(?:getItem|setItem)\s*\(\s*['"`](?:token|access_token|password|contrasena|contraseña|passwordPlano)['"`]/i;

function archivosTs(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    return statSync(ruta).isDirectory() ? archivosTs(ruta) : ruta.endsWith('.ts') ? [ruta] : [];
  });
}

describe('credenciales en el navegador', () => {
  test('el token se almacena en sessionStorage, nunca en localStorage', () => {
    const tokenStorage = readFileSync(join(FRONTEND_SRC, 'app', 'core', 'token-storage.ts'), 'utf8');
    expect(tokenStorage).toMatch(/sessionStorage\.getItem\(TOKEN_KEY\)/);
    expect(tokenStorage).toMatch(/sessionStorage\.setItem\(TOKEN_KEY,\s*token\)/);

    const infractores = archivosTs(FRONTEND_SRC)
      .filter((ruta) => PATRON_CREDENCIAL_EN_LOCALSTORAGE.test(readFileSync(ruta, 'utf8')))
      .map((ruta) => relative(FRONTEND_SRC, ruta));
    expect(infractores).toEqual([]);
  });

  test('el formulario de login elimina borradores de correo y no persiste nuevos', () => {
    const login = readFileSync(join(FRONTEND_SRC, 'app', 'features', 'auth', 'login.component.ts'), 'utf8');
    expect(login).toContain("sessionStorage.removeItem('sigice_login_draft')");
    expect(login).not.toContain('sessionStorage.getItem');
    expect(login).not.toContain('sessionStorage.setItem');
  });

  test('el interceptor limita el Bearer a la API y elimina el token local ante 401', () => {
    const interceptor = readFileSync(join(FRONTEND_SRC, 'app', 'core', 'jwt.interceptor.ts'), 'utf8');
    expect(interceptor).toMatch(/token && req\.url\.includes\('\/api\/'\)/);
    expect(interceptor).toMatch(/Authorization:\s*`Bearer \$\{token\}`/);
    expect(interceptor).toMatch(/status === 401[\s\S]*?limpiarToken\(\)/);
  });

  test('logout elimina el token y el perfil locales del navegador', () => {
    const authService = readFileSync(join(FRONTEND_SRC, 'app', 'core', 'auth.service.ts'), 'utf8');
    expect(authService).toMatch(/salir\(redirigir = true\)[\s\S]*?limpiarToken\(\);[\s\S]*?this\.limpiarTempSso\(\);[\s\S]*?this\.token\.set\(null\);[\s\S]*?this\.usuario\.set\(null\);/);
  });

  test('abandonar el formulario SSO elimina el código temporal de memoria', () => {
    const componente = readFileSync(join(FRONTEND_SRC, 'app', 'features', 'auth', 'sso-completar.component.ts'), 'utf8');
    expect(componente).toMatch(/ngOnDestroy\(\)[\s\S]*?this\.auth\.limpiarTempSso\(\)/);
  });

  test('las rutas verifican sesión y rol antes de permitir el acceso', () => {
    const authGuard = readFileSync(join(FRONTEND_SRC, 'app', 'core', 'auth.guard.ts'), 'utf8');
    const roleGuard = readFileSync(join(FRONTEND_SRC, 'app', 'core', 'role.guard.ts'), 'utf8');
    expect(authGuard).toMatch(/if \(!auth\.token\(\)\)/);
    expect(authGuard).toContain('await auth.cargarPerfil()');
    expect(roleGuard).toMatch(/auth\.usuario\(\)\?\.rol !== rol/);
  });
});

describe('SSO sin credenciales en la URL', () => {
  test('los componentes SSO no leen token ni temp desde fragment/query', () => {
    const archivos = [
      join(FRONTEND_SRC, 'app', 'features', 'auth', 'sso-callback.component.ts'),
      join(FRONTEND_SRC, 'app', 'features', 'auth', 'sso-completar.component.ts'),
    ];
    const infractores = archivos
      .filter((ruta) => /fragment|queryParamMap|#token=|#temp=/i.test(readFileSync(ruta, 'utf8')))
      .map((ruta) => relative(FRONTEND_SRC, ruta));

    expect(infractores).toEqual([]);
  });
});

describe('recuperación sin token en la URL', () => {
  test('el formulario obtiene el código por entrada y lo envía en el cuerpo', () => {
    const componente = readFileSync(join(FRONTEND_SRC, 'app', 'features', 'auth', 'restablecer.component.ts'), 'utf8');
    expect(componente).toContain('formControlName="token"');
    expect(componente).toContain('this.form.value.token!');
    expect(componente).not.toContain('queryParamMap');
    expect(componente).not.toContain('ActivatedRoute');
  });
});
