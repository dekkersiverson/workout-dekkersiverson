import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// For GitHub Pages: replace 'workout-dekkersiverson' with your repo name
export default defineConfig({
  plugins: [react()],
  base: '/workout-dekkersiverson/',
})
