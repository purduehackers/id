#![deny(clippy::unwrap_used)]
#![feature(adt_const_params)]
#![allow(incomplete_features)]

use std::str::FromStr;

use oxide_auth::{
    frontends::dev::Url,
    primitives::registrar::{Client, ClientMap, RegisteredUrl},
};

use thiserror::Error;

pub mod app;
#[cfg(feature = "ssr")]
pub mod oauth;
#[cfg(feature = "ssr")]
pub mod routes;
#[cfg(feature = "ssr")]
pub mod tfa;

#[derive(Debug, Error)]
pub enum Error {
    #[error("Invalid body type")]
    InvalidBodyType,
}

pub const VALID_CLIENTS: [&str; 7] = [
    "dashboard",
    "passports",
    "authority",
    "auth-test",
    "vulcan-auth",
    "shad-moe",
    "shquid",
];

pub fn client_registry() -> ClientMap {
    let mut clients = ClientMap::new();
    clients.register_client(Client::public(
        VALID_CLIENTS[0],
        RegisteredUrl::Semantic(
            Url::from_str("https://dash.purduehackers.com/api/callback").expect("url to be valid"),
        ),
        "user:read".parse().expect("scope to be valid"),
    ));

    clients.register_client(Client::public(
        VALID_CLIENTS[1],
        RegisteredUrl::Semantic(
            Url::from_str("https://passports.purduehackers.com/callback").expect("url to be valid"),
        ),
        "user:read user".parse().expect("scopes to be valid"),
    ));

    clients.register_client(Client::public(
        VALID_CLIENTS[2],
        RegisteredUrl::Semantic(Url::from_str("authority://callback").expect("url to be valid")),
        "admin:read admin".parse().expect("scopes to be valid"),
    ));

    clients.register_client(Client::public(
        VALID_CLIENTS[3],
        RegisteredUrl::Semantic(
            Url::from_str("https://id-auth.purduehackers.com/api/auth/callback/purduehackers-id")
                .expect("url to be valid"),
        ),
        "user:read user".parse().expect("scopes to be valid"),
    ));

    clients.register_client(Client::public(
        VALID_CLIENTS[4],
        RegisteredUrl::Semantic(
            Url::from_str("https://auth.purduehackers.com/source/oauth/callback/purduehackers-id/")
                .expect("url to be valid"),
        ),
        "user:read user".parse().expect("scopes to be valid"),
    ));

    clients.register_client(Client::public(
        VALID_CLIENTS[5],
        RegisteredUrl::Semantic(
            Url::from_str("https://auth.shad.moe/source/oauth/callback/purduehackers-id/")
                .expect("url to be valid"),
        ),
        "user:read user".parse().expect("scopes to be valid"),
    ));

    clients.register_client(Client::public(
        VALID_CLIENTS[6],
        RegisteredUrl::Semantic(
            Url::from_str("https://www.imsqu.id/auth/callback/purduehackers-id")
                .expect("url to be valid"),
        ),
        "user:read".parse().expect("scopes to be valid"),
    ));

    clients
}

#[derive(Debug, serde::Deserialize)]
pub struct PassportRecord {
    pub id: i32,
    pub secret: String,
}
