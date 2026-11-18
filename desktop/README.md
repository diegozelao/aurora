# Aurora Desktop — protótipo 0.1

Cliente Electron para macOS e Windows. Carrega a interface noturna real de https://test.ddtech.cloud/ e usa a sinalização WSS já publicada. Não inclui participantes fictícios nem altera o servidor.

## Executar

Requer Node.js e npm.

```sh
npm install
npm start
```

## Distribuir

Execute `npm run dist` no sistema de destino. Assinatura, notarização e atualização automática ainda precisam ser configuradas antes de distribuição pública.

## Escopo atual

A interface é hospedada no servidor, não empacotada offline. O aplicativo requer internet. O seletor de captura pede confirmação explícita; áudio do sistema está desabilitado. No macOS, autorize gravação de tela nas configurações do sistema. O renderer não possui acesso a Node.js.

## Próximas etapas

- Validar captura e recepção entre Mac, Windows e navegador.
- Migrar a interface React para assets locais com endpoint WSS configurável.
- Criar seletor visual de fontes e testar permissões por plataforma.
- Corrigir negociação concorrente WebRTC e validar TURN entre redes.
- Assinar instaladores e configurar releases no Git.

Builds e chamadas WebSocket isoladas não comprovam transmissão de vídeo ponta a ponta.
