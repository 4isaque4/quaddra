import ProcessosPageClient from '../../processos/ProcessosPageClient'
import { getProcessosByClientType } from '../../processos/processosData'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function ValeShopProcessosPage() {
  const processos = await getProcessosByClientType('valeshop')
  return <ProcessosPageClient processosIniciais={processos} />
}
