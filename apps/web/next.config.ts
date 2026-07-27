import type { NextConfig } from 'next';

const isStaticExport = process.env.FILEFLOW_STATIC_EXPORT === '1';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: isStaticExport ? 'export' : undefined,
  trailingSlash: isStaticExport,
  images: {
    unoptimized: isStaticExport,
  },
  transpilePackages: [
    '@fileflow/ui',
    '@fileflow/contracts',
    '@fileflow/shared-types',
    '@fileflow/operation-registry',
    '@fileflow/local-processing',
  ],
};
export default nextConfig;
