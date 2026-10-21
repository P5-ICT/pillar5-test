// The browser only ever talks to this Next.js server. Requests that start with /api are
// forwarded to the Python backend, so there is one address for students and no CORS setup.
const backend =
  process.env.BACKEND_URL ||
  (process.env.BACKEND_HOSTPORT ? `http://${process.env.BACKEND_HOSTPORT}` : "http://127.0.0.1:8000");

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${backend}/api/:path*` }];
  },
};

export default nextConfig;
