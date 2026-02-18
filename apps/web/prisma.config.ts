/**
 * Prisma 7 – configuração do CLI (migrate, db push, etc.).
 * A URL do banco vem de DATABASE_URL em .env ou .env.local.
 */
import { config } from 'dotenv'
import { resolve } from 'path'
import { defineConfig, env } from 'prisma/config'

// Carrega .env.local primeiro (onde costuma estar DATABASE_URL no Next.js), depois .env
const cwd = process.cwd()
config({ path: resolve(cwd, '.env.local') })
config({ path: resolve(cwd, '.env') })

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
})
