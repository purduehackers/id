#![deny(clippy::unwrap_used)]
#![feature(adt_const_params)]
#![allow(incomplete_features)]

use leptos::{prelude::*, server_fn::codec::JsonEncoding};

pub mod app;
#[cfg(feature = "ssr")]
pub mod jwt;
#[cfg(feature = "ssr")]
pub mod oauth;
pub mod pages;
#[cfg(feature = "ssr")]
pub mod routes;
#[cfg(feature = "ssr")]
pub mod tfa;

#[server]
pub async fn scan_post(id: i32, secret: String) -> Result<(), LeptosRouteError> {
    Ok(crate::routes::scan::post_handler(id, secret).await?)
}

#[cfg(feature = "hydrate")]
#[wasm_bindgen::prelude::wasm_bindgen]
pub fn hydrate() {
    use crate::app::*;
    console_error_panic_hook::set_once();
    leptos::mount::hydrate_body(App);
}

#[derive(Debug, serde::Deserialize)]
pub struct PassportRecord {
    pub id: i32,
    pub secret: String,
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub enum LeptosRouteError {
    InternalServerError(String),
    BadRequest,
    Unauthorized,
    PassportDisabled,
    UserNotFound,
    Leptos(ServerFnErrorErr),
}

#[cfg(feature = "ssr")]
impl From<crate::routes::RouteError> for LeptosRouteError {
    fn from(err: crate::routes::RouteError) -> Self {
        use crate::routes::RouteError;
        match err {
            RouteError::UserNotFound => LeptosRouteError::UserNotFound,
            RouteError::Unauthorized => LeptosRouteError::Unauthorized,
            RouteError::BadRequest => LeptosRouteError::BadRequest,
            RouteError::PassportDisabled => LeptosRouteError::PassportDisabled,
            _ => LeptosRouteError::InternalServerError(err.to_string()),
        }
    }
}

impl FromServerFnError for LeptosRouteError {
    type Encoder = JsonEncoding;
    fn from_server_fn_error(value: leptos::prelude::ServerFnErrorErr) -> Self {
        Self::Leptos(value)
    }
}
