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
      // /r/ zeigt je nach Query ein anderes Rezept und ist noindex, gehoert also nicht in die Sitemap
      filter: (page) => new URL(page).pathname !== '/r/'
    })
  ],
  vite: {
    plugins: [tailwindcss()]
  }
});
