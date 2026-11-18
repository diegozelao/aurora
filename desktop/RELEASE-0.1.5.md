# Aurora 0.1.5

O aplicativo continua carregando a interface publicada em https://aurora.ddtech.cloud/.

- Três salas, com troca direta mantendo o nome. Ao mudar de sala, câmera, microfone e compartilhamento são encerrados.
- Atualização manual com timeout, atualização automática a cada 15 segundos e reconexão acionada pelo usuário.
- Participantes e mídias sincronizados por snapshots completos. Sinalização bloqueada entre salas diferentes.
- Volume de saída e silenciamento aplicados ao áudio recebido. Microfone e câmera são iniciados somente por ação do usuário.
- No desktop, dispositivos exigem confirmação do usuário e permissões do sistema. Captura de tela continua apenas com vídeo.
- Botões seguindo o tema noturno, convite por sala, foco e tela cheia.

Validação: testes do servidor com clientes WebSocket, interface em DOM simulado com dois clientes e mídia simulada, negociação WebRTC simulada, seletor desktop e permissões; revisão visual no navegador. Essas verificações não substituem testes de captura e áudio com dispositivos reais em macOS/Windows e redes distintas. TURN ainda não está configurado.

Builds: DMG macOS ARM64/x64 e NSIS Windows x64/ARM64. Sem assinatura de distribuição ou notarização.

Fontes do site e testes: /Users/diegodavidtech/Documents/ChatGPT/aurora/test.
Teste local: `node --test rooms.test.js rtc.test.js interface.test.js` nessa pasta.
Testes desktop: `node --test permissions.test.cjs picker.test.cjs capture.test.cjs` na pasta do app.
