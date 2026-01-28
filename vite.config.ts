import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // 让打包后的资源使用相对路径，方便直接部署 dist 目录
  base: './',
  // 将项目根目录下的 icon 文件夹作为静态资源目录，构建时会拷贝到 dist 根目录
  publicDir: 'icon',
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    }
  }
});
