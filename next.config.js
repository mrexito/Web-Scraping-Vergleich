/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    // disables automatic workspace root inference issues and reduces weird hangs
    root: __dirname,
  },
};

module.exports = nextConfig;