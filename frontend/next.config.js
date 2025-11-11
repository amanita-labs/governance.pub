/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Enable compression for better performance
  compress: true,
  // Optimize images
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'api.memegen.link',
      },
    ],
  },
  // Enable SWC minification (faster than Terser) - default in Next.js 13+
  // Optimize production builds
  productionBrowserSourceMaps: false,
}

module.exports = nextConfig

