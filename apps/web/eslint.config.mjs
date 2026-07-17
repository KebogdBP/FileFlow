import config from '@fileflow/eslint-config/next';

export default [
  ...config,
  {
    ignores: ['.next/**', 'out/**', 'build/**', 'coverage/**', 'next-env.d.ts'],
  },
];
