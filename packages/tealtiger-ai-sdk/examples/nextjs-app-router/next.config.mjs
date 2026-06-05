import path from 'node:path';
import { fileURLToPath } from 'node:url';

const exampleDir = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // The core TealTiger SDK is a server-only runtime peer; keep it out of the
  // Next server bundle so its provider graph stays optional.
  serverExternalPackages: ['tealtiger-sdk'],
  turbopack: {
    root: exampleDir,
  },
};

export default nextConfig;
