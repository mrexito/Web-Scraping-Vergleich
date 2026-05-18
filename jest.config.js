/** 
 * For a detailed explanation regarding each configuration property, visit:
 * https://jestjs.io/docs/configuration
 */

/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  clearMocks: true,
  // Indicates which provider should be used to instrument code for coverage
  coverageProvider: "v8",
  transformIgnorePatterns: ["node_modules/(?!(@ngrx|deck.gl|ng-dynamic))"],
  testPathIgnorePatterns: ['/node_modules/', '/.next/', '/scraping/'],
};

module.exports = config;
