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
  webpack: (config, { isServer, defaultLoaders }) => {
    // Get the absolute path to src directory
    // Try multiple methods to ensure it works in all environments
    const projectRoot = process.cwd() || __dirname;
    const srcPath = path.resolve(projectRoot, 'src');
    
    // Ensure resolve exists
    if (!config.resolve) {
      config.resolve = {};
    }
    
    // Set alias - critical for @/ imports
    // Use both the alias and ensure it's an absolute path
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@': srcPath,
    };
    
    // Ensure extensions include .ts and .tsx
    if (!config.resolve.extensions) {
      config.resolve.extensions = [];
    }
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.json'];
    extensions.forEach(ext => {
      if (!config.resolve.extensions.includes(ext)) {
        config.resolve.extensions.push(ext);
      }
    });

    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
};

export default nextConfig;
