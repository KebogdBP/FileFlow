import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: process.env.FILEFLOW_STATIC_EXPORT === '1' ? 'export' : undefined,
  trailingSlash: process.env.FILEFLOW_STATIC_EXPORT === '1',
  transpilePackages: [
    '@fileflow/ui',
    '@fileflow/contracts',
    '@fileflow/shared-types',
    '@fileflow/operation-registry',
    '@fileflow/local-processing',
  ],
};
export default nextConfig;
