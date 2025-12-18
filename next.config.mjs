import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Vercel doesn't need standalone output
  // Image optimization
  images: {
    domains: ['instagram.com', 'cdninstagram.com', 'scontent.cdninstagram.com'],
    unoptimized: false,
  },
  // Disable ESLint during builds for now
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Disable TypeScript errors during builds
  typescript: {
    ignoreBuildErrors: false,
  },
  // Allow dynamic pages to skip static generation
  experimental: {
    missingSuspenseWithCSRBailout: false,
  },
  // Webpack configuration for Supabase and path aliases
  webpack: (config, { isServer }) => {
    // Get the absolute path to src directory - use multiple methods for reliability
    const projectRoot = process.cwd();
    const srcPath = path.resolve(projectRoot, 'src');
    
    // CRITICAL: Ensure resolve and alias exist
    config.resolve = config.resolve || {};
    config.resolve.alias = config.resolve.alias || {};
    
    // Set the @ alias - this MUST be an absolute path
    // Use Object.assign to ensure it's set correctly
    Object.assign(config.resolve.alias, {
      '@': srcPath,
    });
    
    // Debug: Log the alias in development (won't show in Vercel but helps locally)
    if (process.env.NODE_ENV === 'development') {
      console.log('Webpack alias @ set to:', srcPath);
    }

    // Client-side fallbacks
    if (!isServer) {
      config.resolve.fallback = {
        ...(config.resolve.fallback || {}),
        fs: false,
        net: false,
        tls: false,
      };
    }
    
    return config;
  },
};

export default nextConfig;
