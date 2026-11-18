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
          }, {
            name: 'charts-vendor',
            test: /node_modules[\\/](?:recharts|d3-[a-z-]+|victory-vendor|es-toolkit|immer|reselect|@reduxjs|redux|react-redux|decimal\.js-light|eventemitter3)[\\/]/,
          }],
        },
      },
    },
  },
  test: { environment: 'node', clearMocks: true },
});
