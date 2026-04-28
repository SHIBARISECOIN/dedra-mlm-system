import { defineConfig } from 'vite';
import build from '@hono/vite-build/cloudflare-pages';
import devServer from '@hono/vite-dev-server';
import adapter from '@hono/vite-dev-server/cloudflare';
import path from 'path';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  plugins: [
    nodePolyfills({
      include: ['buffer', 'crypto', 'stream', 'util', 'events']
    }),
    build(),
    devServer({
      adapter,
      entry: 'src/index.tsx'
    })
  ],
  resolve: {
    alias: [
      { find: /^rpc-websockets\/.*/, replacement: path.resolve(__dirname, 'mock-rpc.js') }
    ]
  }
})
