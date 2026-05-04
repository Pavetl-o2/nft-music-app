/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['placeholder.com'],
  },
  experimental: {
    serverBodyLimit: '20mb',
  },
}

module.exports = nextConfig

