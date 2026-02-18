import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * GET /api/test-db – testa a conexão com o banco e lista contagens das tabelas.
 * Use no navegador: http://localhost:3000/api/test-db
 */
export async function GET() {
  try {
    const [processCount, elementCount, migrationCount] = await Promise.all([
      prisma.process.count(),
      prisma.processElement.count(),
      prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*)::bigint as count FROM _prisma_migrations
      `,
    ])

    return NextResponse.json({
      ok: true,
      message: 'Conexão com o banco OK',
      tables: {
        processes: processCount,
        process_elements: elementCount,
        _prisma_migrations: Number(migrationCount[0]?.count ?? 0),
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido'
    console.error('[test-db]', error)
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    )
  }
}
