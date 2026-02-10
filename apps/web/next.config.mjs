/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true,
    // Aumentar limite de body size para Server Actions (50MB)
    // Nota: No App Router, não há configuração direta para API Routes
    // O limite padrão de 1MB pode ser aumentado apenas através de proxy reverso
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
  // Otimizações para produção
  compress: true,
  poweredByHeader: false,
};

export default nextConfig;