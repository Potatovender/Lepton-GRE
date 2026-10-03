import { defineConfig } from "vitest/config";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const sampleDirectory = fileURLToPath(new URL("./sample code", import.meta.url));
const licenceFiles = new Map(["mathquill", "mediabunny"].map((name) => [
  `/src/libs/${name}/LICENSE`, fileURLToPath(new URL(`./src/libs/${name}/LICENSE`, import.meta.url))
]));

export default defineConfig({
  plugins: [{
    name: "lepton-static-text",
    configureServer(server) {
      // Extensionless samples and licences are data, not JavaScript modules.
      server.middlewares.use(async (request, response, next) => {
        if (!request.url || !["GET", "HEAD"].includes(request.method ?? "")) return next();
        let pathname;
        try { pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname); }
        catch { return next(); }
        const prefix = "/sample code/";
        let file = licenceFiles.get(pathname);
        if (!file) {
          if (!pathname.startsWith(prefix)) return next();
          file = resolve(sampleDirectory, pathname.slice(prefix.length));
          if (dirname(file) !== sampleDirectory) return next();
        }
        try {
          const source = await readFile(file);
          response.setHeader("Content-Type", "text/plain; charset=utf-8");
          response.setHeader("Cache-Control", "no-cache");
          response.end(request.method === "HEAD" ? undefined : source);
        } catch (error) {
          next(error);
        }
      });
    }
  }],
  test: {
    environment: "node",
    globals: true
  }
});
