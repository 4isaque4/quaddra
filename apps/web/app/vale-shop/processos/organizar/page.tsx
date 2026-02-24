import ProcessosOrganizarPageClient from '../../../processos/organizar/ProcessosOrganizarPageClient'
import { getProcessosByClientType } from '../../../processos/processosData'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function ValeShopOrganizarProcessosPage() {
  const processos = await getProcessosByClientType('valeshop')
  return <ProcessosOrganizarPageClient processos={processos} clientType="valeshop" basePath="/vale-shop" />
}
