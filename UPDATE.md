# Atualização do projeto Aurora

Este arquivo registra o trabalho para alinhar o projeto em `dev/projects/aurora` à estrutura já organizada em `Documents/ChatGPT/aurora`.

## Etapa 1 - Diagnóstico e definição da estrutura - concluída

- Foi confirmado que o diretório de destino continha somente o cliente Electron e seus instaladores.
- A interface React/Vite e o servidor HTTP/WebSocket estavam no projeto de referência em `Documents/ChatGPT/aurora`.
- Os instaladores e arquivos do aplicativo Electron foram preservados e realocados para `desktop/`.
- A estrutura final definida foi `front/`, `back/`, `desktop/` e `docs/`.

## Etapa 2 - Sincronização, ajustes e validação - concluída

- A interface React/Vite foi adicionada em `front/`.
- O servidor HTTP/WebSocket e seus testes foram adicionados em `back/`.
- O aplicativo Electron, suas dependências e os instaladores existentes foram mantidos em `desktop/`.
- A raiz passou a conter `package.json`, `README.md` e `.gitignore` para coordenar os módulos.
- O back-end foi configurado para servir `front/dist` na porta 3001.
- O Vite foi configurado para encaminhar `/ws` ao back-end durante o desenvolvimento.
- O build do front foi executado com sucesso.
- Os quatro testes de integração passaram com sucesso.

## Estrutura final

```text
aurora/
├── back/      servidor HTTP/WebSocket e testes
├── desktop/   aplicativo Electron e instaladores existentes
├── docs/      documentação de apoio
├── front/     interface React/Vite
├── README.md  instruções de execução
└── package.json
```

## Comandos principais

```sh
npm run dev:back
npm run dev:front
npm run build
npm start
```
