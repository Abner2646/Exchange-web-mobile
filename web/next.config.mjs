/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone', // lean Node bundle for self-hosting behind nginx on the EC2 box
  reactStrictMode: true,

  // Dev-only same-origin proxy: in production nginx maps /api and /health to the
  // backend (:3001), so the browser talks to one origin. Locally there is no
  // nginx, so `next dev` proxies the same paths to the backend, letting the app
  // actually reach it (login/register/etc.) without CORS or a NEXT_PUBLIC_API_URL.
  // No-op in production builds (rewrites() is only applied by the dev/standalone
  // server here, and prod traffic is fronted by nginx anyway).
  async rewrites() {
    if (process.env.NODE_ENV === 'production') return [];
    const backend = process.env.BACKEND_PROXY_URL || 'http://localhost:3001';
    return [
      { source: '/api/:path*', destination: `${backend}/api/:path*` },
      { source: '/health', destination: `${backend}/health` },
    ];
  },
};

export default nextConfig;
