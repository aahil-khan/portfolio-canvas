import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
   * Standalone server output, for the Docker image only. Vercel runs its own packaging and its
   * build fails outright with standalone on (`ENOENT .next/next-server.js.nft.json`) — every
   * Vercel deploy from 1aeff73 to the fix failed that way. `VERCEL` is set in Vercel's builds.
   */
  output: process.env.VERCEL ? undefined : 'standalone',

  /*
   * `/resume` was the plain, printable surface back when `/` was the canvas. The front page is
   * that surface now, so the route is gone — but the URL has been shared, so it redirects rather
   * than 404s. Permanent, because it is never coming back.
   */
  async redirects() {
    return [{ source: '/resume', destination: '/', permanent: true }]
  },
};

export default nextConfig;
