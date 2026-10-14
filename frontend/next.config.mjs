const proxyTarget = process.env.API_PROXY_TARGET?.trim().replace(/\/$/, '');

if (!proxyTarget) {
  throw new Error('API_PROXY_TARGET is empty');
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${proxyTarget}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
