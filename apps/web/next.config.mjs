/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true,
  },
  // Otimizações para produção
  compress: true,
  poweredByHeader: false,
};

export default nextConfig;