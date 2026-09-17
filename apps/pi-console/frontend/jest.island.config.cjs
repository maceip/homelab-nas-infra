module.exports = {
  testEnvironment: 'jsdom',
  testMatch: ['<rootDir>/tests/island.test.js', '<rootDir>/tests/files.test.js', '<rootDir>/tests/observability.test.js'],
  setupFilesAfterEnv: ['@testing-library/jest-dom'],
  transform: { '^.+\\.[jt]sx?$': ['babel-jest', { babelrc: false, configFile: false, presets: [['@babel/preset-env', { targets: { node: 'current' } }], ['@babel/preset-react', { runtime: 'automatic' }]] }] },
  moduleNameMapper: { '\\.css$': '<rootDir>/tests/styleMock.cjs', '\\.(svg|png|webp|woff2)$': '<rootDir>/tests/assetMock.cjs' }
}
