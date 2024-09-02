import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import aiGenPlugin from "./vite-plugin-ai-gen";
import UnoCSS from "unocss/vite";
// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());
  return {
    plugins: [
      react(),
      aiGenPlugin({
        apiKey: env.VITE_API_KEY as string,
        baseURL: env.VITE_BASE_URL as string,
        model: env.VITE_MODEL as string,
        cacheFilePath: "./src/gen/ai-components-cache.json",
      }),
      UnoCSS(),
    ],
  };
});
