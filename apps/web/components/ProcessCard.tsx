'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FileText } from 'lucide-react';

type ProcessCardProps = {
  slug: string;
  nome: string;
};

export default function ProcessCard({ slug, nome }: ProcessCardProps) {
  const [displayName, setDisplayName] = useState(nome);

  useEffect(() => {
    // Carregar nome customizado do localStorage
    try {
      const storageKey = `process_custom_names`;
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const names = JSON.parse(stored);
        if (names[slug]) {
          setDisplayName(names[slug]);
        }
      }
    } catch (e) {
      console.warn('Erro ao carregar nome customizado:', e);
    }
  }, [slug]);

  return (
    <div className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:transform hover:-translate-y-2">
      <div className="p-6">
        <div className="flex justify-center mb-3">
          <FileText className="w-10 h-10 text-orange-500" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2 line-clamp-2">
          {displayName}
        </h3>
        <Link 
          href={`/processos/${slug}`}
          className="inline-block w-full text-center bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-semibold transition-all duration-300 mt-4"
        >
          Visualizar
        </Link>
      </div>
    </div>
  );
}
