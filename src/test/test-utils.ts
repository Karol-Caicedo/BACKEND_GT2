/** Fábricas de mocks reutilizables para los specs unitarios. */

/* eslint-disable @typescript-eslint/no-explicit-any */
export function mockRepository<T extends object = any>() {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((dto: Partial<T>) => ({ ...dto }) as T),
    save: jest.fn((e: unknown) =>
      Promise.resolve(
        Array.isArray(e)
          ? e.map((x, i) => ({ id: `uuid-test-${i}`, ...x }))
          : ({ id: 'uuid-test', ...(e as object) }),
      ),
    ),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
    remove: jest.fn((e: unknown) => Promise.resolve(e)),
    count: jest.fn(),
    createQueryBuilder: jest.fn(),
    manager: { query: jest.fn().mockResolvedValue([]) },
  };
}

export type MockRepo = ReturnType<typeof mockRepository>;

export function mockUsersService() {
  return {
    findByCorreo: jest.fn(),
    findById: jest.fn(),
    create: jest.fn((d: unknown) =>
      Promise.resolve({ id: 'uuid-user', ...(d as object) }),
    ),
    save: jest.fn((u: unknown) => Promise.resolve(u)),
    countBySemestre: jest.fn(),
  };
}
