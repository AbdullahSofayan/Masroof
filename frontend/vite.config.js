import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "0.0.0.0",
    proxy: {
      "/api": {
        target: process.env.VITE_DEV_API_TARGET || "http://127.0.0.1:8000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [{
            name: "animation-vendor",
            test: /node_modules[\\/](?:gsap|motion|motion-dom|motion-utils|framer-motion)[\\/]/,
          }, {
            name: "charts-vendor",
            test: /node_modules[\\/](?:recharts|d3-[a-z-]+|victory-vendor|es-toolkit|immer|reselect|@reduxjs|redux|react-redux|decimal\.js-light|eventemitter3)[\\/]/,
          }],
        },
      },
    },
  },
  test: { environment: "node", clearMocks: true },
});
