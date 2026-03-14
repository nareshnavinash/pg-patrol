/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  moduleNameMapper: {
    '\\.(css|less|scss)$': 'identity-obj-proxy',
    '^@/(.*)$': '<rootDir>/src/$1',
    '^react$': 'preact/compat',
    '^react-dom$': 'preact/compat',
    '^react-dom/client$': 'preact/compat',
    '^react/jsx-runtime$': 'preact/jsx-runtime',
    '^@testing-library/react$': '<rootDir>/node_modules/@testing-library/preact/dist/cjs/index.js',
    '^@testing-library/preact$': '<rootDir>/node_modules/@testing-library/preact/dist/cjs/index.js',
  },
  setupFiles: ['<rootDir>/tests/unit/setup.ts'],
  setupFilesAfterEnv: ['<rootDir>/tests/unit/jest-dom-setup.ts'],
  transform: {
    '^.+\\.[jt]sx?$': [
      'ts-jest',
      {
        tsconfig: {
          jsx: 'react-jsx',
          jsxImportSource: 'preact',
          module: 'commonjs',
          moduleResolution: 'node',
          allowImportingTsExtensions: false,
          allowJs: true,
          paths: {
            '@/*': ['src/*'],
          },
        },
      },
    ],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(@2toad/profanity|preact|@testing-library/preact)/)',
  ],
};
