#![deny(clippy::unwrap_used)]
#![feature(adt_const_params)]
#![allow(incomplete_features)]
#![recursion_limit = "256"]

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

#[server]
pub async fn get_current_user() -> Result<Option<UserInfo>, LeptosRouteError> {
    use chrono::Utc;
    use entity::{auth_session, user};
    use entity::prelude::{AuthSession, User};
    use leptos_axum::extract;
    use axum_extra::extract::CookieJar;
    use sea_orm::{prelude::*, Condition};

    let state: crate::routes::RouteState = use_context()
        .ok_or_else(|| LeptosRouteError::InternalServerError("No state".to_string()))?;

    let cookies: CookieJar = extract().await
        .map_err(|e| LeptosRouteError::InternalServerError(format!("Failed to extract cookies: {e:?}")))?;

    let session_token = match cookies.get("session") {
        Some(cookie) => cookie.value().to_string(),
        None => return Ok(None),
    };

    let session = AuthSession::find()
        .filter(
            Condition::all()
                .add(auth_session::Column::Token.eq(&session_token))
                .add(auth_session::Column::Until.gte(Utc::now())),
        )
        .one(&state.db)
        .await
        .map_err(|e| LeptosRouteError::InternalServerError(e.to_string()))?;

    let session = match session {
        Some(s) => s,
        None => return Ok(None),
    };

    let user: Option<user::Model> = User::find_by_id(session.owner_id)
        .one(&state.db)
        .await
        .map_err(|e| LeptosRouteError::InternalServerError(e.to_string()))?;

    match user {
        Some(u) => Ok(Some(UserInfo {
            id: u.id,
            discord_id: u.discord_id,
            role: format!("{:?}", u.role),
        })),
        None => Ok(None),
    }
}

#[server]
pub async fn get_my_clients() -> Result<Vec<ClientResponse>, LeptosRouteError> {
    use chrono::Utc;
    use entity::{auth_session, oauth_client};
    use entity::prelude::{AuthSession, OAuthClient};
    use leptos_axum::extract;
    use axum_extra::extract::CookieJar;
    use sea_orm::{prelude::*, Condition};

    let state: crate::routes::RouteState = use_context()
        .ok_or_else(|| LeptosRouteError::InternalServerError("No state".to_string()))?;

    let cookies: CookieJar = extract().await
        .map_err(|e| LeptosRouteError::InternalServerError(format!("Failed to extract cookies: {e:?}")))?;

    let session_token = cookies.get("session")
        .ok_or(LeptosRouteError::Unauthorized)?
        .value()
        .to_string();

    let session = AuthSession::find()
        .filter(
            Condition::all()
                .add(auth_session::Column::Token.eq(&session_token))
                .add(auth_session::Column::Until.gte(Utc::now())),
        )
        .one(&state.db)
        .await
        .map_err(|e| LeptosRouteError::InternalServerError(e.to_string()))?
        .ok_or(LeptosRouteError::Unauthorized)?;

    let clients: Vec<oauth_client::Model> = OAuthClient::find()
        .filter(oauth_client::Column::OwnerId.eq(session.owner_id))
        .all(&state.db)
        .await
        .map_err(|e| LeptosRouteError::InternalServerError(e.to_string()))?;

    Ok(clients
        .into_iter()
        .map(|c| ClientResponse {
            id: c.id,
            client_id: c.client_id,
            name: c.name,
            redirect_uri: c.redirect_uri,
            scopes: c.default_scope,
            is_confidential: c.client_secret.is_some(),
            created_at: c.created_at.to_rfc3339(),
        })
        .collect())
}

#[server]
pub async fn create_client(req: CreateClientRequest) -> Result<ClientCreatedResponse, LeptosRouteError> {
    use chrono::Utc;
    use entity::{auth_session, oauth_client, user};
    use entity::prelude::{AuthSession, User};
    use entity::sea_orm_active_enums::RoleEnum;
    use leptos_axum::extract;
    use axum_extra::extract::CookieJar;
    use sea_orm::{prelude::*, ActiveValue, Condition};
    use rand::distributions::{Alphanumeric, DistString};
    use uuid::Uuid;

    let state: crate::routes::RouteState = use_context()
        .ok_or_else(|| LeptosRouteError::InternalServerError("No state".to_string()))?;

    let cookies: CookieJar = extract().await
        .map_err(|e| LeptosRouteError::InternalServerError(format!("Failed to extract cookies: {e:?}")))?;

    let session_token = cookies.get("session")
        .ok_or(LeptosRouteError::Unauthorized)?
        .value()
        .to_string();

    let session = AuthSession::find()
        .filter(
            Condition::all()
                .add(auth_session::Column::Token.eq(&session_token))
                .add(auth_session::Column::Until.gte(Utc::now())),
        )
        .one(&state.db)
        .await
        .map_err(|e| LeptosRouteError::InternalServerError(e.to_string()))?
        .ok_or(LeptosRouteError::Unauthorized)?;

    let user: user::Model = User::find_by_id(session.owner_id)
        .one(&state.db)
        .await
        .map_err(|e| LeptosRouteError::InternalServerError(e.to_string()))?
        .ok_or(LeptosRouteError::UserNotFound)?;

    // Validate scopes based on user role
    let allowed_scopes = if user.role == RoleEnum::Admin {
        vec!["user:read", "user", "admin:read", "admin"]
    } else {
        vec!["user:read", "user"]
    };

    for scope in &req.scopes {
        if !allowed_scopes.contains(&scope.as_str()) {
            return Err(LeptosRouteError::Forbidden);
        }
    }

    // Generate client_id and optional client_secret
    let client_id = Uuid::new_v4().to_string();
    let client_secret = if req.is_confidential {
        Some(Alphanumeric.sample_string(&mut rand::thread_rng(), 48))
    } else {
        None
    };

    // Build scope string (always include auth)
    let scope_str = req.scopes.join(" ");

    let new_client = oauth_client::ActiveModel {
        id: ActiveValue::NotSet,
        client_id: ActiveValue::Set(client_id.clone()),
        client_secret: ActiveValue::Set(client_secret.clone()),
        owner_id: ActiveValue::Set(session.owner_id),
        redirect_uri: ActiveValue::Set(req.redirect_uri.clone()),
        default_scope: ActiveValue::Set(scope_str.clone()),
        name: ActiveValue::Set(req.name.clone()),
        created_at: ActiveValue::Set(Utc::now().into()),
    };

    let model = new_client
        .insert(&state.db)
        .await
        .map_err(|e| LeptosRouteError::InternalServerError(e.to_string()))?;

    // Refresh the client registry cache
    state.registry.refresh_cache().await
        .map_err(|e| LeptosRouteError::InternalServerError(e.to_string()))?;

    Ok(ClientCreatedResponse {
        id: model.id,
        client_id: model.client_id,
        name: model.name,
        redirect_uri: model.redirect_uri,
        scopes: model.default_scope,
        is_confidential: model.client_secret.is_some(),
        created_at: model.created_at.to_rfc3339(),
        client_secret,
    })
}

#[server]
pub async fn delete_client(id: i32) -> Result<(), LeptosRouteError> {
    use chrono::Utc;
    use entity::{auth_session, oauth_client};
    use entity::prelude::{AuthSession, OAuthClient};
    use leptos_axum::extract;
    use axum_extra::extract::CookieJar;
    use sea_orm::{prelude::*, Condition};

    let state: crate::routes::RouteState = use_context()
        .ok_or_else(|| LeptosRouteError::InternalServerError("No state".to_string()))?;

    let cookies: CookieJar = extract().await
        .map_err(|e| LeptosRouteError::InternalServerError(format!("Failed to extract cookies: {e:?}")))?;

    let session_token = cookies.get("session")
        .ok_or(LeptosRouteError::Unauthorized)?
        .value()
        .to_string();

    let session = AuthSession::find()
        .filter(
            Condition::all()
                .add(auth_session::Column::Token.eq(&session_token))
                .add(auth_session::Column::Until.gte(Utc::now())),
        )
        .one(&state.db)
        .await
        .map_err(|e| LeptosRouteError::InternalServerError(e.to_string()))?
        .ok_or(LeptosRouteError::Unauthorized)?;

    // Find the client and verify ownership
    let client: oauth_client::Model = OAuthClient::find_by_id(id)
        .one(&state.db)
        .await
        .map_err(|e| LeptosRouteError::InternalServerError(e.to_string()))?
        .ok_or(LeptosRouteError::BadRequest)?;

    if client.owner_id != session.owner_id {
        return Err(LeptosRouteError::Forbidden);
    }

    // Delete the client
    OAuthClient::delete_by_id(id)
        .exec(&state.db)
        .await
        .map_err(|e| LeptosRouteError::InternalServerError(e.to_string()))?;

    // Refresh the client registry cache
    state.registry.refresh_cache().await
        .map_err(|e| LeptosRouteError::InternalServerError(e.to_string()))?;

    Ok(())
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
    Forbidden,
    Leptos(ServerFnErrorErr),
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct UserInfo {
    pub id: i32,
    pub discord_id: i64,
    pub role: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ClientResponse {
    pub id: i32,
    pub client_id: String,
    pub name: String,
    pub redirect_uri: String,
    pub scopes: String,
    pub is_confidential: bool,
    pub created_at: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ClientCreatedResponse {
    pub id: i32,
    pub client_id: String,
    pub name: String,
    pub redirect_uri: String,
    pub scopes: String,
    pub is_confidential: bool,
    pub created_at: String,
    pub client_secret: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct CreateClientRequest {
    pub name: String,
    pub redirect_uri: String,
    pub scopes: Vec<String>,
    pub is_confidential: bool,
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
