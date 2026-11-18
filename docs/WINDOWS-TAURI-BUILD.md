# Aurora Tauri no Windows

## Build local

No Windows, abra o PowerShell na raiz do projeto:

```powershell
npm install
cargo install tauri-cli --version "^2"
cd desktop-tauri
cargo tauri build --bundles nsis,msi
```

Os instaladores ficam em `desktop-tauri\target\release\bundle\nsis\` e `desktop-tauri\target\release\bundle\msi\`.

## Publicar na VPS

Envie o instalador NSIS usando o nome fixo abaixo para sobrescrever a versão anterior:

```powershell
scp .\target\release\bundle\nsis\Aurora_2.0.0_x64-setup.exe root@72.61.43.229:/ddtech-cloud/nginx/html/downloads/Aurora-Windows.exe
```

Link estável: `https://aurora.ddtech.cloud/downloads/Aurora-Windows.exe`

## GitHub Actions

O workflow `.github/workflows/tauri-windows.yml` pode ser executado em **Actions > Build Aurora Windows > Run workflow**. Ele gera o instalador como artefato em um runner Windows.

## Estado atual

- Aurora: `2.0.0`
- Backend: `https://aurora.ddtech.cloud`
- WebSocket: `wss://aurora.ddtech.cloud/ws`
- macOS publicado: `/downloads/Aurora-macOS.dmg`
- Windows Tauri: aguardando a primeira build em Windows
