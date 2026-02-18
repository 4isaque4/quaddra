import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | null }

function createPrisma(): PrismaClient {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Set it in .env or .env.local to use the database.',
    )
  }
  const adapter = new PrismaPg({ connectionString: url })
  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === 'development'
        ? (['query', 'error', 'warn'] as const)
        : ['error'],
  })
}

/**
 * Prisma client singleton. Uses driver adapter (Prisma 7).
 * Inicializado na primeira utilização para não falhar o build quando DATABASE_URL não está definida.
 */
function getPrisma(): PrismaClient {
  if (globalForPrisma.prisma) return globalForPrisma.prisma
  const client = createPrisma()
  if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = client
  return client
}

/** Proxy que atrasa a criação do PrismaClient até o primeiro uso (evita erro no next build sem DATABASE_URL). */
export const prisma = new Proxy({} as PrismaClient, {
  get(_, prop) {
    return (getPrisma() as unknown as Record<string, unknown>)[prop as string]
  },
}) as PrismaClient
