import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      // Needed so mobile can use Vite (5173) as a dev gateway and still receive Socket.IO events.
      "/socket.io": {
        target: "http://127.0.0.1:4000",
        ws: true,
        changeOrigin: true
      },
      "/auth": "http://127.0.0.1:4000",
      "/profile": "http://127.0.0.1:4000",
      "/match": "http://127.0.0.1:4000",
      "/messages": "http://127.0.0.1:4000",
      "/moderation": "http://127.0.0.1:4000",
      "/media-proxy": "http://127.0.0.1:4000",
      "/admin-api": {
        target: "http://127.0.0.1:4000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/admin-api/, "/admin")
      },
      "/uploads": "http://127.0.0.1:4000",
      "/health": "http://127.0.0.1:4000"
    }
  }
});
