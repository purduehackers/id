/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      {
        source: "/",
        destination: "/authorize",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
