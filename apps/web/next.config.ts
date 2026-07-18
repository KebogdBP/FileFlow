import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@fileflow/ui',
    '@fileflow/contracts',
    '@fileflow/shared-types',
    '@fileflow/operation-registry',
    '@fileflow/local-processing',
  ],
};
export default nextConfig;
