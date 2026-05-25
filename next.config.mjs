/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=()' },
]

const nextConfig = {
  headers: async () => [
    {
      source: '/:path*',
      headers: securityHeaders,
    },
    {
      source: '/driver',
      headers: [
        ...securityHeaders,
        { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
      ],
    },
    {
      source: '/driver/:path*',
      headers: [
        ...securityHeaders,
        { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
      ],
    },
  ],
}

export default nextConfig
