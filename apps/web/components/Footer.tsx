export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300 py-12">
      <div className="container text-center">
        <div className="flex items-center justify-center space-x-2 mb-4">
          <div className="w-6 h-6 bg-orange-500 rounded flex items-center justify-center">
            <span className="text-white font-bold text-xs">Q</span>
          </div>
          <span className="text-xl font-bold text-white">QUADDRA</span>
        </div>
        <p className="text-sm">
          &copy; 2024 Quaddra. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  )
}
