# Aurora

Projeto organizado por responsabilidade:

- `front/`: interface React/Vite.
- `back/`: servidor HTTP e WebSocket.
- `desktop/`: cliente Electron opcional.

## Desenvolvimento

Instale as dependências na raiz:

```sh
npm install
```

Para redes restritivas, copie `front/.env.example` para `front/.env` e configure
`VITE_ICE_SERVERS` com servidores STUN/TURN. Credenciais TURN devem ser
temporárias e fornecidas pelo ambiente de deploy.

Em terminais separados, execute:

```sh
npm run dev:back
npm run dev:front
```

O front abre com Vite e encaminha o WebSocket para o back na porta 3001. Para produção, execute `npm run build` e depois `npm start`. A versão atual é `2.0.0`.
