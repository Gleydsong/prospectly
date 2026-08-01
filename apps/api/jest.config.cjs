/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        // Jest transpile-only config: isolatedModules avoids Node16 hybrid warning (TS151002).
        // Full typechecking remains in CI via `pnpm typecheck` (apps/api/tsconfig.json).
        tsconfig: 'tsconfig.jest.json',
      },
    ],
  },
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  collectCoverageFrom: ['src/**/*.ts', '!src/main.ts'],
};
