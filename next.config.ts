import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /** Standalone server output for the Docker deploy on aahil-server (`stage deploy`). */
  output: 'standalone',

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
