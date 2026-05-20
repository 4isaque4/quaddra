'use client';

import { ChevronDown, ChevronUp } from 'lucide-react';

export default function PageScrollControls() {
  const scrollPage = (direction: 'up' | 'down') => {
    const amount = Math.max(window.innerHeight * 0.75, 360);
    window.scrollBy({
      top: direction === 'down' ? amount : -amount,
      behavior: 'smooth',
    });
  };

  return (
    <div className="fixed right-3 bottom-5 z-[90] flex flex-col gap-2 sm:right-5 sm:bottom-6">
      <button
        type="button"
        onClick={() => scrollPage('up')}
        aria-label="Subir pagina"
        title="Subir pagina"
        className="h-11 w-11 rounded-full border border-gray-200 bg-white/95 text-gray-700 shadow-lg transition hover:-translate-y-0.5 hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/20"
      >
        <ChevronUp className="mx-auto h-5 w-5" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => scrollPage('down')}
        aria-label="Descer pagina"
        title="Descer pagina"
        className="h-11 w-11 rounded-full border border-gray-200 bg-white/95 text-gray-700 shadow-lg transition hover:translate-y-0.5 hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/20"
      >
        <ChevronDown className="mx-auto h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  );
}
