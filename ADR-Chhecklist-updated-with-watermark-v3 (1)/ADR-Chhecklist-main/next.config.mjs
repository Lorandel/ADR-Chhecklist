/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  experimental: {
    serverComponentsExternalPackages: ['googleapis', 'nodemailer']
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push('googleapis', 'nodemailer')
    }
    return config
  }
}

export default nextConfig
