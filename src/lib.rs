use serde::Serialize;
use std::str::FromStr;


use oxide_auth::{
    frontends::dev::Url,
    primitives::registrar::{Client, ClientMap, RegisteredUrl},
};

pub fn client_registry() -> ClientMap {
    let mut clients = ClientMap::new();
    clients.register_client(Client::public(
        "dashboard",
        RegisteredUrl::Semantic(Url::from_str("http://localhost:8080/callback").unwrap()),
        "read".parse().unwrap(),
    ));
    clients
}

#[derive(Serialize)]
pub struct APIError<'a> {
    pub message: &'a str,
    pub code: &'a str,
}
