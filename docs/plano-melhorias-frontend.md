# Plano de melhorias do frontend

## Base protegida

- `back/interface.test.js` cobre entrada, troca de sala, áudio, captura de tela, convite, sincronização e limpeza de mídia.
- `back/rtc.test.js` cobre negociação WebRTC, candidatos ICE, remoção de tracks e colisão de ofertas.
- `back/frontend.test.js` cobre o frontend de produção, health check, assets, fallback SPA e respostas 404.
- `npm test` e `npm run build` devem continuar obrigatórios antes de publicar.

## Fase 1 — confiabilidade e manutenção

1. Dividir `front/src/main.jsx` em hooks e componentes menores: conexão, mídia, sala, participantes e controles.
2. Corrigir o script `front.start`, que referencia um `server.js` inexistente.
3. Remover arquivos CSS/JS antigos que não são importados ou documentar por que permanecem.
4. Adicionar testes para permissão negada, reconexão, convite sem Clipboard API e encerramento do componente.

## Fase 2 — conectividade e produção

1. Configurar TURN como fallback do STUN para redes restritivas.
2. Tornar endpoint, versão, timeout e limites de mídia configuráveis por ambiente.
3. Adicionar reconexão com backoff limitado e telemetria de estados WebSocket/WebRTC.
4. Definir cache de assets com hash e `no-cache` apenas para HTML/health.

## Fase 3 — experiência e acessibilidade

1. Revisar navegação por teclado, foco, `aria-live` e mensagens de permissão.
2. Testar layouts nos breakpoints móveis e telas ultrawide.
3. Adicionar estados visuais para conexão degradada, mídia aguardando e áudio bloqueado.
4. Adicionar testes de acessibilidade e uma validação manual em Chrome, Safari e Firefox.

## Critério de aceite

Cada fase deve preservar os testes existentes, adicionar cobertura para o comportamento novo e manter `npm test`, `npm run build` e o smoke test WebSocket passando.
