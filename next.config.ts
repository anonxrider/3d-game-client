import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Public assets have stable names: keep them briefly, then revalidate
        // with ETag instead of downloading unchanged files again. Next manages
        // its own fingerprinted JS/CSS with a one-year immutable cache.
        source: '/:asset((?!api/|_next/).*\\.(?:svg|png|jpg|jpeg|webp|avif|gif|ico|woff|woff2|glb|gltf|bin|ktx2|mp3|ogg|wav|wasm))',
        headers: [{
          key: 'Cache-Control',
          value: process.env.NODE_ENV === 'production'
            ? 'public, max-age=3600, must-revalidate'
            : 'no-store',
        }],
      },
      {
        source: '/api/:path*',
        headers: [{ key: 'Cache-Control', value: 'private, no-store' }],
      },
    ];
  },
};

export default nextConfig;
