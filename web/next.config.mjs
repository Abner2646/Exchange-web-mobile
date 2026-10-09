/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone', // lean Node bundle for self-hosting behind nginx on the EC2 box
  reactStrictMode: true,
};

export default nextConfig;
