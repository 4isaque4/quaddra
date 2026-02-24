import ProcessosOrganizarPageClient from './ProcessosOrganizarPageClient'
import { getProcessosByClientType } from '../processosData'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function OrganizarProcessosPage() {
  const processos = await getProcessosByClientType('quaddra')
  return <ProcessosOrganizarPageClient processos={processos} clientType="quaddra" basePath="" />
}
