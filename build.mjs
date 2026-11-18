import * as esbuild from 'esbuild';
await esbuild.build({entryPoints:['src/app.js'],bundle:true,minify:true,format:'iife',target:'es2019',outfile:'www/app.js'});
console.log('build ok');
