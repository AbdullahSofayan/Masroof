import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [{
            name: 'animation-vendor',
            test: /node_modules[\\/](?:gsap|motion|motion-dom|motion-utils|framer-motion)[\\/]/,
          }],
        },
      },
    },
  },
  test: { environment: 'node', clearMocks: true },
});
