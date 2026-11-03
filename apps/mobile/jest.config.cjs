module.exports = {
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/*.native-test.{ts,tsx}',
    '!src/app/**/_layout.tsx',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/src/test/jest-setup.ts'],
  testMatch: ['<rootDir>/src/**/*.native-test.{ts,tsx}'],
  transformIgnorePatterns: [
    'node_modules/(?!(.pnpm|(jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|expo-router|@react-navigation/.*|react-navigation|react-native-safe-area-context))',
  ],
};
