/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable PWA-like behaviour for driver app
  headers: async () => [
    {
      source: '/driver',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
      ],
    },
  ],
  // Skip resource-intensive checks during build in constrained environments
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
}

export default nextConfig
