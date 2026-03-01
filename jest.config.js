/** 
 * For a detailed explanation regarding each configuration property, visit:
 * https://jestjs.io/docs/configuration
 */

/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  transform: {
    '^.+\.ts?$': 'ts-jest',
  },
  clearMocks: true,
  // Indicates which provider should be used to instrument code for coverage
  coverageProvider: "v8",
  transformIgnorePatterns: ["node_modules/(?!(@ngrx|deck.gl|ng-dynamic))"],
};

module.exports = config;
