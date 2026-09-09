/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.alicdn.com' },
      { protocol: 'https', hostname: '**.alibaba.com' },
      { protocol: 'https', hostname: '**.1688.com' },
      { protocol: 'https', hostname: 'ae01.alicdn.com' },
      { protocol: 'https', hostname: 'ae02.alicdn.com' },
      { protocol: 'https', hostname: 'ae03.alicdn.com' },
      { protocol: 'https', hostname: 's.alicdn.com' },
      { protocol: 'https', hostname: '**.amazon.com' },
      { protocol: 'https', hostname: '**.amazon.fr' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: '**.googleusercontent.com' },
    ],
  },
}

export default nextConfig