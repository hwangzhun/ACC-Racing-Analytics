import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

import { cloudflare } from "@cloudflare/vite-plugin";

// GitHub Pages 项目站为 https://<user>.github.io/<仓库名>/，需与仓库路径一致
const PAGES_BASE = '/ACC-Racing-Analytics/';

export default defineConfig(({ mode }) => ({
  // 默认相对路径，便于任意静态托管；npm run build:Pages 使用 mode=pages 走子路径 base
  base: mode === 'pages' ? PAGES_BASE : './',
  // 将项目根目录下的 icon 文件夹作为静态资源目录，构建时会拷贝到 dist 根目录
  publicDir: 'icon',
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  plugins: [react(), cloudflare()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    }
  }
}));