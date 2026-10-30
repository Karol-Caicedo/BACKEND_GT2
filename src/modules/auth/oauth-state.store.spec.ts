import type { Request, Response } from 'express';
import { OAuthStateStore } from './oauth-state.store';

const SECRET = 'un-secreto-de-prueba-con-mas-de-32-caracteres';

function buildReq(cookie?: string) {
  const res = { cookie: jest.fn(), clearCookie: jest.fn() } as unknown as Response;
  const req = { headers: cookie ? { cookie } : {}, res } as unknown as Request;
  return { req, res };
}

function guardar(store: OAuthStateStore) {
  const { req, res } = buildReq();
  let handle = '';
  store.store(req, undefined, {}, (err, value) => {
    expect(err).toBeNull();
    handle = value ?? '';
  });
  expect(res.cookie).toHaveBeenCalledTimes(1);
  expect(handle).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  return handle;
}

describe('OAuthStateStore', () => {
  const store = new OAuthStateStore(SECRET);

  test('emite state firmado y cookie HttpOnly', () => {
    const handle = guardar(store);
    const { req, res } = buildReq();
    store.store(req, undefined, {}, () => undefined);
    const opciones = (res.cookie as jest.Mock).mock.calls[0][2];
    expect(opciones).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/api/auth' });
    expect(handle).toContain('.');
  });

  test('acepta el callback cuando state y cookie coinciden', () => {
    const handle = guardar(store);
    const { req, res } = buildReq(`otra=1; sigice_oauth_state=${encodeURIComponent(handle)}`);
    let ok = false;
    store.verify(req, handle, (err, value) => {
      expect(err).toBeNull();
      ok = value === true;
    });
    expect(ok).toBe(true);
    expect(res.clearCookie).toHaveBeenCalledWith('sigice_oauth_state', { path: '/api/auth' });
  });

  test.each([
    ['sin cookie', undefined, 'state'],
    ['sin state', 'sigice_oauth_state=abc.def', undefined],
    ['state distinto', 'sigice_oauth_state=abc.def', 'otro.state'],
    ['firma manipulada', 'sigice_oauth_state=abc.def', 'abc.def'],
  ])('rechaza %s', (_caso, cookie, state) => {
    const { req } = buildReq(cookie);
    let ok = true;
    store.verify(req, state, (err, value) => {
      expect(err).toBeNull();
      ok = value === true;
    });
    expect(ok).toBe(false);
  });
});
