'use client';

import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { Header, Footer } from '@/components';
import ProcessOrganizationContent from '@/components/ProcessOrganizationContent';
import type { ProcessoItem } from '../processosData';

interface ProcessosOrganizarPageClientProps {
  processos: ProcessoItem[];
  clientType: 'quaddra' | 'valeshop';
  basePath?: '' | '/vale-shop';
}

export default function ProcessosOrganizarPageClient({
  processos,
  clientType,
  basePath = '',
}: ProcessosOrganizarPageClientProps) {
  const router = useRouter();

  const listPath = `${basePath}/processos` as Route;

  return (
    <>
      <Header />
      <main className="pt-20 min-h-screen bg-gray-50">
        <div className="container py-12">
          <ProcessOrganizationContent
            processos={processos}
            clientType={clientType}
            onBack={() => router.push(listPath)}
            onUpdate={() => router.refresh()}
          />
        </div>
      </main>
      <Footer />
    </>
  );
}
