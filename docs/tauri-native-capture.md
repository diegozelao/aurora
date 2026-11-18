# Captura nativa de mídia no Aurora Tauri

## Objetivo

Permitir que o aplicativo Tauri no macOS compartilhe uma janela, aplicativo ou
monitor com áudio real do sistema, incluindo jogos e vídeos, sem depender da
implementação limitada de `getDisplayMedia` do WebView.

## Contrato do capturador

O módulo nativo deverá expor ao frontend Tauri:

- `list_sources`: lista monitores, janelas e aplicativos capturáveis;
- `start_capture(source_id, with_audio)`: inicia vídeo e áudio da fonte;
- `stop_capture`: encerra e libera a captura;
- eventos de encerramento, erro e alteração de permissão.

Cada sessão deve entregar uma faixa de vídeo e uma faixa de áudio compatíveis
com a camada WebRTC do Aurora. O frontend web continuará usando
`getDisplayMedia`.

## Implementação macOS

O primeiro adaptador será baseado em ScreenCaptureKit e exigirá a permissão
macOS de Gravação de Tela. A camada Tauri/Rust fará a ponte de comandos e
eventos; a camada WebRTC será responsável por publicar as faixas para a sala.

## Critério de aceite

Antes de remover o fallback atual, validar no `.app` assinado:

1. janela de um aplicativo;
2. monitor inteiro;
3. vídeo do YouTube com áudio;
4. jogo com áudio;
5. encerramento pelo usuário e pelo sistema;
6. reconexão da sala sem deixar captura ou áudio ativos.

