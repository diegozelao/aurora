use axum::{extract::{State, WebSocketUpgrade}, response::{IntoResponse, Json}, routing::get, Router};
use axum::extract::ws::{Message, WebSocket};
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{collections::HashMap, net::SocketAddr, sync::Arc};
use tokio::sync::{mpsc, RwLock};
use tower_http::services::ServeDir;
use uuid::Uuid;

const ROOMS: [&str; 3] = ["Sala principal", "Sala de reuniões", "Sala de apresentação"];

#[derive(Clone)]
struct AppState { clients: Arc<RwLock<HashMap<Uuid, Client>>> }

#[derive(Clone)]
struct Client { tx: mpsc::UnboundedSender<Message>, room: Option<String>, name: String, media: HashMap<String, String> }

#[derive(Debug, Deserialize)]
struct Incoming { #[serde(rename = "type")] kind: String, room: Option<String>, name: Option<String>, text: Option<String>, media: Option<HashMap<String, String>>, active: Option<bool>, to: Option<Uuid>, offer: Option<Value>, answer: Option<Value>, candidate: Option<Value> }

#[derive(Serialize)]
struct Participant { id: Uuid, name: String, media: HashMap<String, String> }

#[tokio::main]
async fn main() {
    let state = AppState { clients: Arc::new(RwLock::new(HashMap::new())) };
    let app = Router::new()
        .route("/health", get(health))
        .route("/ws", get(websocket))
        .fallback_service(ServeDir::new("front/dist").append_index_html_on_directories(true))
        .with_state(state);
    let addr: SocketAddr = ([0, 0, 0, 0], std::env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(3001)).into();
    println!("Aurora Rooms Rust listening on {addr}");
    let listener = tokio::net::TcpListener::bind(addr).await.expect("bind server");
    axum::serve(listener, app).await.expect("serve server");
}

async fn health() -> impl IntoResponse { Json(json!({ "ok": true, "version": "2.0.0", "runtime": "rust" })) }

async fn websocket(ws: WebSocketUpgrade, State(state): State<AppState>) -> impl IntoResponse { ws.on_upgrade(move |socket| handle_socket(socket, state)) }

async fn handle_socket(socket: WebSocket, state: AppState) {
    let id = Uuid::new_v4();
    let (mut sink, mut stream) = socket.split();
    let (tx, mut rx) = mpsc::unbounded_channel::<Message>();
    tokio::spawn(async move { while let Some(message) = rx.recv().await { if sink.send(message).await.is_err() { break; } } });
    state.clients.write().await.insert(id, Client { tx, room: None, name: String::new(), media: HashMap::new() });
    while let Some(Ok(message)) = stream.next().await {
        match message { Message::Text(text) => process(id, &state, &text).await, Message::Close(_) => break, _ => {} }
    }
    let room = state.clients.write().await.remove(&id).and_then(|client| client.room);
    if room.is_some() { broadcast_snapshot(&state, room.as_deref()).await; }
}

async fn process(id: Uuid, state: &AppState, text: &str) {
    let Ok(message) = serde_json::from_str::<Incoming>(text) else { return send(state, id, json!({"type":"error","message":"Mensagem inválida."})).await };
    match message.kind.as_str() {
        "join" => {
            let Some(room) = message.room.filter(|room| ROOMS.contains(&room.as_str())) else { return send(state, id, json!({"type":"error","message":"Sala inválida."})).await };
            let Some(name) = message.name.filter(|name| !name.trim().is_empty()) else { return send(state, id, json!({"type":"error","message":"Nome inválido."})).await };
            let previous = { let mut clients = state.clients.write().await; let client = clients.get_mut(&id).unwrap(); let previous = client.room.clone(); client.room = Some(room.clone()); client.name = name.trim().chars().take(32).collect(); client.media.clear(); previous };
            broadcast_snapshot(state, previous.as_deref()).await; broadcast_snapshot(state, Some(&room)).await;
        }
        "sync" => broadcast_snapshot_for(state, id).await,
        "chat" => { let Some(text) = message.text.filter(|text| !text.trim().is_empty()) else { return }; let clients = state.clients.read().await; let Some(sender) = clients.get(&id) else { return }; let Some(room) = sender.room.clone() else { return }; let payload = json!({"type":"chat","room":room,"from":id,"name":sender.name,"text":text.trim().chars().take(1000).collect::<String>(),"at":now_ms()}); for client in clients.values().filter(|client| client.room.as_deref() == Some(room.as_str())) { let _ = client.tx.send(Message::Text(payload.to_string().into())); } }
        "media" => { let mut clients = state.clients.write().await; if let Some(client) = clients.get_mut(&id) { client.media = message.media.unwrap_or_default().into_iter().filter(|(_, value)| value.len() <= 128).collect(); let room = client.room.clone(); drop(clients); broadcast_snapshot(state, room.as_deref()).await; } }
        "sharing" => { let mut clients = state.clients.write().await; if let Some(client) = clients.get_mut(&id) { if message.active.unwrap_or(false) { client.media.insert("screen".into(), "legacy".into()); } else { client.media.remove("screen"); } let room = client.room.clone(); drop(clients); broadcast_snapshot(state, room.as_deref()).await; } }
        "offer" | "answer" | "candidate" | "request-offer" => forward_signal(id, state, &message).await,
        _ => {}
    }
}

async fn forward_signal(id: Uuid, state: &AppState, message: &Incoming) { let Some(target) = message.to else { return }; let clients = state.clients.read().await; let Some(sender) = clients.get(&id) else { return }; let Some(room) = sender.room.as_deref() else { return }; let Some(receiver) = clients.get(&target).filter(|client| client.room.as_deref() == Some(room)) else { return }; let mut payload = json!({"type":message.kind,"room":room,"from":id}); if let Some(value) = &message.offer { payload["offer"] = value.clone(); } if let Some(value) = &message.answer { payload["answer"] = value.clone(); } if let Some(value) = &message.candidate { payload["candidate"] = value.clone(); } let _ = receiver.tx.send(Message::Text(payload.to_string().into())); }

async fn broadcast_snapshot_for(state: &AppState, id: Uuid) { let room = state.clients.read().await.get(&id).and_then(|client| client.room.clone()); broadcast_snapshot_to(state, id, room.as_deref()).await; }
async fn broadcast_snapshot(state: &AppState, room: Option<&str>) { let clients = state.clients.read().await; let ids: Vec<Uuid> = clients.iter().filter(|(_, client)| client.room.as_deref() == room).map(|(id, _)| *id).collect(); drop(clients); for id in ids { broadcast_snapshot_to(state, id, room).await; } }
async fn broadcast_snapshot_to(state: &AppState, id: Uuid, room: Option<&str>) { let clients = state.clients.read().await; let Some(client) = clients.get(&id) else { return }; let participants: Vec<Participant> = clients.iter().filter(|(_, client)| client.room.as_deref() == room).map(|(id, client)| Participant { id: *id, name: client.name.clone(), media: client.media.clone() }).collect(); let sharing: Vec<Uuid> = participants.iter().filter(|participant| participant.media.contains_key("screen")).map(|participant| participant.id).collect(); let payload = json!({"type":"participants","room":room,"self":id,"participants":participants,"sharing":sharing}); let _ = client.tx.send(Message::Text(payload.to_string().into())); }
async fn send(state: &AppState, id: Uuid, payload: Value) { if let Some(client) = state.clients.read().await.get(&id) { let _ = client.tx.send(Message::Text(payload.to_string().into())); } }
fn now_ms() -> u64 { std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis() as u64 }

