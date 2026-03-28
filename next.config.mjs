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
}

export default nextConfig
