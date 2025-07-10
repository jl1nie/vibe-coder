/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  trailingSlash: false,
  
  // Disable static optimization for error pages to avoid Html import issues
  experimental: {
    forceSwcTransforms: true,
  },
  
  // Static file serving from public directory
  assetPrefix: '',
  
  // Webpack configuration for browser polyfills
  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      // Add browser polyfills for Node.js globals
      config.resolve.fallback = {
        ...config.resolve.fallback,
        process: false,
        buffer: false,
        crypto: false,
        stream: false,
        fs: false,
        path: false,
      };
      
      // Define process.env for browser
      config.plugins.push(
        new webpack.DefinePlugin({
          'process.env': JSON.stringify({}),
          'process.browser': JSON.stringify(true),
        })
      );
    }
    return config;
  },
  
  // API Routes configuration
  async rewrites() {
    return [
      // Root serves PWA index.html
      {
        source: '/',
        destination: '/index.html'
      },
      // Assets from public directory
      {
        source: '/assets/:path*',
        destination: '/assets/:path*'
      },
      {
        source: '/manifest.webmanifest',
        destination: '/manifest.webmanifest'
      },
      {
        source: '/sw.js',
        destination: '/sw.js'
      },
      {
        source: '/registerSW.js',
        destination: '/registerSW.js'
      }
    ];
  },

  // Headers for CORS and caching
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*'
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET,POST,PUT,DELETE,OPTIONS'
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type,Authorization'
          },
          {
            key: 'Access-Control-Allow-Credentials',
            value: 'true'
          }
        ]
      },
      {
        source: '/assets/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable'
          }
        ]
      }
    ];
  }
};

module.exports = nextConfig;