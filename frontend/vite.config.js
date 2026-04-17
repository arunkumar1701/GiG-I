import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Prevent Vite from following Windows junctions/symlinks
    // (C:\Users\DELL\Downloads is a junction to D:\downloads on this machine)
    preserveSymlinks: true,
  },
})
