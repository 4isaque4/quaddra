import ProcessosPageClient from './ProcessosPageClient'
import { getProcessosByClientType } from './processosData'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function ProcessosPage() {
  const processos = await getProcessosByClientType('quaddra')
  return <ProcessosPageClient processosIniciais={processos} />
}
