import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/admin/login',
        destination: '/admin-login'
      }
    ];
  }
};

export default nextConfig;
