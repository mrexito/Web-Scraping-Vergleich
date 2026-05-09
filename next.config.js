const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    // disables automatic workspace root inference issues and reduces weird hangs
    root: __dirname,
  },
  // Exclude Python virtual environments and Playwright bundles from build tracing.
  // Reason: app/scraping/ contains Python venv folders with Playwright JS/HTML/font files
  // that Webpack tries to bundle and fails on. These files are runtime-only for the
  // Python scraper scripts and should never be included in the Next.js production bundle.
  outputFileTracingExcludes: {
    '*': [
      './app/scraping/**',
      './node_modules/@swc/core-linux-x64-gnu',
      './node_modules/@swc/core-linux-x64-musl',
    ],
  },
  webpack: (config) => {
    // Tell Webpack to ignore everything inside app/scraping/ when bundling.
    // This prevents the build from crashing on Python venv binary files.
    config.module.rules.push({
      test: /[\\/]app[\\/]scraping[\\/].*/,
      use: 'ignore-loader',
    });
    return config;
  },
};

module.exports = nextConfig;
