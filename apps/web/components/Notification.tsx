'use client';

import { useEffect } from 'react';

interface NotificationProps {
  tipo: 'sucesso' | 'erro' | 'aviso';
  mensagem: string;
  onClose: () => void;
  duracao?: number;
}

export default function Notification({ tipo, mensagem, onClose, duracao = 5000 }: NotificationProps) {
  useEffect(() => {
    if (duracao > 0) {
      const timer = setTimeout(onClose, duracao);
      return () => clearTimeout(timer);
    }
  }, [duracao, onClose]);

  const cores = {
    sucesso: 'bg-orange-50 border-orange-500 text-orange-800',
    erro: 'bg-orange-50 border-orange-500 text-orange-800',
    aviso: 'bg-orange-50 border-orange-500 text-orange-800'
  };

  const icones = {
    sucesso: (
      <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    erro: (
      <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    aviso: (
      <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    )
  };

  return (
    <div className="fixed top-24 right-4 z-[150] animate-slide-in">
      <div className={`rounded-lg shadow-2xl p-6 max-w-md border-2 ${cores[tipo]}`}>
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 mt-0.5">
            {icones[tipo]}
          </div>
          <div className="flex-1">
            <p className="font-semibold text-gray-900 mb-1">
              {tipo === 'sucesso' ? 'Sucesso!' : tipo === 'erro' ? 'Erro!' : 'Atenção!'}
            </p>
            <p className="text-gray-700">{mensagem}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
