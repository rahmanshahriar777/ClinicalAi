import { Test } from '@nestjs/testing';

import { PrismaService } from './infra/prisma/prisma.service';

/**
 * Wiring test: every module, guard and provider must resolve without a
 * database. Catches missing imports/circular dependencies at unit-test time.
 */
describe('AppModule wiring', () => {
  const prismaStub = {
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    promptTemplate: { findFirst: jest.fn(async () => ({ id: 'x' })), create: jest.fn() },
  };

  beforeAll(() => {
    process.env.DATABASE_URL = 'postgresql://stub';
    process.env.JOBS_INLINE = 'true';
    process.env.LOG_LEVEL = 'silent';
    process.env.NODE_ENV = 'test';
  });

  it('compiles the application module graph', async () => {
    const { AppModule } = await import('./app.module');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(PrismaService).useValue(prismaStub).compile();
    const app = moduleRef.createNestApplication();
    await app.init();
    expect(prismaStub.$connect).not.toHaveBeenCalled(); // stub is used, real client never connects
    await app.close();
  });
});
