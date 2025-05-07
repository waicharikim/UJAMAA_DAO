export default {
    preset: 'ts-jest/presets/default-esm', // preset for ESM + ts-jest
    testEnvironment: 'node',
    extensionsToTreatAsEsm: ['.ts', '.mts'],
    testMatch: ['**/tests/**/*.test.mts'],
    moduleFileExtensions: ['ts', 'mts', 'js', 'jsx', 'json', 'node'],
    transform: {
      '^.+\\.tsx?$': ['ts-jest', { useESM: true }],
    },
  };