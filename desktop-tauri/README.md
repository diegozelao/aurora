# Aurora Desktop (Tauri)

Cliente desktop experimental em Rust/Tauri, reutilizando o frontend React/Vite
atual. O Electron permanece disponível enquanto esta versão é validada.

O cliente Tauri está configurado para conectar ao backend de produção em
`wss://aurora.ddtech.cloud/ws`.

## Requisitos

- Rust e Cargo via <https://rustup.rs>
- Xcode completo instalado (Command Line Tools sozinho não é suficiente para o ScreenCaptureKit)
- Dependências de build do Tauri para o sistema operacional
- Dependências do projeto instaladas com `npm install`

Gere os ícones nativos uma vez antes do primeiro build:

```sh
cargo tauri icon icons/icon.svg
```

## Testar em desenvolvimento

Na raiz do projeto:

```sh
cargo tauri dev --manifest-path desktop-tauri/Cargo.toml
```

## Gerar instalador

```sh
cargo tauri build --manifest-path desktop-tauri/Cargo.toml
```

As permissões de câmera, microfone e captura de tela são declaradas no bundle
macOS e solicitadas pelo frontend através das APIs do navegador/WebRTC.

O capturador nativo exige macOS 13 ou superior e o SDK completo do Xcode.

