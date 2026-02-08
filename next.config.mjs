/** @type {import('next').NextConfig} */
const nextConfig = {
  // This repo is deployed on Vercel under multiple hostnames (tsbio.life + www.tsbio.life)
  // and may sit behind proxy layers. In some environments, Next.js' built-in URL
  // normalisation redirects (slash/encoding/host/proto) can accidentally create
  // redirect loops. These experimental flags reduce that risk.
  experimental: {
    // Avoid automatic redirects for trailing slashes.
    // (Safe no-op on versions that don't use it.)
    skipTrailingSlashRedirect: true,
    // Avoid middleware URL normalisation redirects.
    skipMiddlewareUrlNormalize: true,
  },

  // Next.js 16 removed `eslint` option from next.config.
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
