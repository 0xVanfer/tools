import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  base: '/tools/',
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
})
