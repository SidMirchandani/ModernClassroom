import type { NextConfig } from "next";

/**
 * `next dev` and `next build` both write to `.next`, and the dev server does
 * not survive having that directory rebuilt or removed underneath it — the
 * page goes to a bare "Internal Server Error" until the server is restarted,
 * which looks exactly like a bug in the app and is not one.
 *
 * So a verification build can be sent somewhere else:
 *
 *     npm run build:check     # writes .next-build, leaves the dev server alone
 *
 * A real deploy build still uses `.next`, because that is what every host
 * expects to find.
 */
const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
