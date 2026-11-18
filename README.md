# Espaço Criativo

App pessoal "olhar dentro da mente": pensamentos soltos com o átomo no centro, Fio do tempo, Diário e Base.
Um código só para PC (Electron) e celular (PWA). Dados offline no aparelho + sincronização pelo Turso.

- `src/` código do app (Preact + htm) · `www/` versão pronta (abre no navegador / vira o PWA)
- `desktop/` empacotamento Electron para Windows
- Build: `npm install && node build.mjs` · Instalador: `cd desktop && cp -r ../www www && npx electron-builder --win --x64`
