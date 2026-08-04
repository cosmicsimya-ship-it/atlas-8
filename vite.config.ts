import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const backendTarget = process.env.VITE_BACKEND_URL?.replace(/\/$/, '') || 'http://localhost:3001';

const apiProxy = {
  '/api': {
    target: backendTarget,
    changeOrigin: true,
  },
  '/sitemap.xml': {
    target: backendTarget,
    changeOrigin: true,
  },
  '/robots.txt': {
    target: backendTarget,
    changeOrigin: true,
  },
} as const;

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  // Same-origin /api in dev/preview — avoids cross-origin "Failed to fetch" (CORS).
  server: { proxy: { ...apiProxy } },
  preview: { proxy: { ...apiProxy } },
});
