# Aurora Rust backend

Servidor Rust compatível com o protocolo WebSocket atual do Aurora. Ele mantém
o frontend web existente, incluindo as permissões de câmera, microfone e
compartilhamento de tela, que continuam sendo solicitadas pelo navegador via
`getUserMedia` e `getDisplayMedia`.

## Execução

```sh
cargo run --manifest-path rust-backend/Cargo.toml
```

O servidor espera encontrar o build em `front/dist`, expõe `/health` e o
WebSocket em `/ws`. A troca do backend Node pelo Rust deve ocorrer somente após
instalar Rust/Cargo e validar a suíte de integração equivalente.

