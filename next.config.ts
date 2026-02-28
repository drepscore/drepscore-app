import type { NextConfig } from "next";
import path from "path";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  // Fix MeshJS/libsodium bundling issues with webpack
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Server: mark Cardano/WASM packages as external (use CJS at runtime)
      config.externals = config.externals || [];
      config.externals.push({
        'libsodium-wrappers-sumo': 'commonjs libsodium-wrappers-sumo',
        '@emurgo/cardano-serialization-lib-browser': 'commonjs @emurgo/cardano-serialization-lib-browser',
        '@emurgo/cardano-serialization-lib-nodejs': 'commonjs @emurgo/cardano-serialization-lib-nodejs',
      });
    } else {
      // Client: alias ESM libsodium (which tries to import a missing .mjs) to the CJS
      // build. We use path.resolve (not require.resolve) to bypass the package's
      // exports field restriction and point directly to the file.
      config.resolve.alias = {
        ...config.resolve.alias,
        'libsodium-wrappers-sumo': path.resolve(
          './node_modules/libsodium-wrappers-sumo/dist/modules-sumo/libsodium-wrappers.js'
        ),
      };
    }

    // Handle WASM files
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    return config;
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
});
