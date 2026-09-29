import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Egyetlen index.html-be épít mindent (a kottamotort is),
// így a kész program internet nélkül, dupla kattintással megnyitható.
export default defineConfig({
  base: './', // relatív útvonalak: bárhonnan (akár fájlból) megnyitható
  plugins: [viteSingleFile()],
});
