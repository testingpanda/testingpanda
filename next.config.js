/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Never leak file contents through static optimization; every page that
  // touches tax data is rendered dynamically and server-side.
  experimental: {
    serverComponentsExternalPackages: ["pdf-parse", "pdf-lib", "archiver", "@aws-sdk/client-s3"],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
