import { apiNoStoreMiddleware } from './api-no-store.middleware';

describe('apiNoStoreMiddleware', () => {
  test('marca todas las respuestas API como no almacenables', () => {
    const setHeader = jest.fn();
    const next = jest.fn();
    apiNoStoreMiddleware(
      { originalUrl: '/api/auth/me?x=1' } as never,
      { setHeader } as never,
      next,
    );
    expect(setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('no altera el cache de recursos no API', () => {
    const setHeader = jest.fn();
    const next = jest.fn();
    apiNoStoreMiddleware(
      { originalUrl: '/assets/logo.jpg' } as never,
      { setHeader } as never,
      next,
    );
    expect(setHeader).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });
});
