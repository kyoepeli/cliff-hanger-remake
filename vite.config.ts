import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths so the build works from any subpath, e.g. GitHub
  // Pages project sites served at https://<user>.github.io/<repo>/.
  base: './',
});
