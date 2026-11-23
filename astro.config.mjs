// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://brewmind.app',
  trailingSlash: 'always',
  integrations: [
    sitemap({
      // /r/ zeigt je nach Query ein anderes Rezept und ist noindex, gehoert also nicht in die Sitemap.
      // /auth/apple/ ist nur der Rueckweg der Apple-Anmeldung in die App, ebenfalls noindex.
      // /e/ zeigt den Einladungscode aus dem Fragment, ebenfalls noindex.
      filter: (page) => !['/r/', '/e/', '/auth/apple/'].includes(new URL(page).pathname)
    })
  ],
  vite: {
    plugins: [tailwindcss()]
  }
});
