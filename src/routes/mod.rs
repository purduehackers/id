use axum::{extract::FromRequestParts, http::StatusCode, response::IntoResponse};
use fred::{
    prelude::{Client, *},
    types::Builder,
};
use oxide_auth::{
    code_grant::error::{AccessTokenErrorType, AuthorizationErrorType},
    endpoint::OAuthError,
    frontends::simple::endpoint::Vacant,
};
use oxide_auth_async::endpoint::resource::ResourceFlow;
use oxide_auth_axum::{OAuthResource, WebError};
use sea_orm::{Database, DatabaseConnection};
use std::{
    env,
    marker::{ConstParamTy, PhantomData},
    time::SystemTimeError,
};
use thiserror::Error;

use crate::{
    oauth::{DbAuthorizer, DbIssuer, OAuthEndpoint},
    routes::oauser::OAuthUser,
};

pub mod client;
pub mod door;
pub mod new;
pub mod passport;
pub mod scan;
pub mod user;

#[derive(Debug, Clone)]
pub struct RouteState {
    db: DatabaseConnection,
    kv: Client,
    issuer: DbIssuer,
    authorizer: DbAuthorizer,
}

impl RouteState {
    pub async fn new() -> Result<Self, RouteError> {
        let db = db().await?;
        let kv = kv().await?;
        Ok(Self {
            db: db.clone(),
            kv,
            issuer: DbIssuer::new(db.clone()),
            authorizer: DbAuthorizer::new(db.clone()),
        })
    }
}

async fn kv() -> Result<Client, RouteError> {
    let config = Config::from_url(
        &env::var("KV_URL")
            .expect("KV_URL env var to be present")
            .replace("redis://", "rediss://"),
    )?;
    let c = Builder::from_config(config).build()?;
    c.init().await?;
    Ok(c)
}

async fn db() -> Result<DatabaseConnection, RouteError> {
    let db = Database::connect(
        env::var("POSTGRES_URL_NON_POOLING").expect("Database URL var to be present"),
    )
    .await?;
    use migration::{Migrator, MigratorTrait};
    Migrator::up(&db, None).await?;

    Ok(db)
}

#[derive(Debug, Error)]
pub enum RouteError {
    #[error("Web error: {0}")]
    Web(#[from] WebError),
    #[error("User not found")]
    UserNotFound,
    #[error("Database error: {0}")]
    Db(#[from] sea_orm::DbErr),
    #[error("Redis error: {0}")]
    Redis(#[from] fred::error::Error),
    #[error("Time error: {0}")]
    Time(#[from] SystemTimeError),
    #[error("OAuth error: {0}")]
    OAuth(#[from] OAuthError),
    #[error("Authorization error: {0:?}")]
    Auth(AuthorizationErrorType),
    #[error("Access token error: {0:?}")]
    AccessToken(AccessTokenErrorType),
    #[error("Bad request")]
    BadRequest,
    #[error("Unauthorized")]
    Unauthorized,
    #[error("Chrono parse error: {0}")]
    ChronoParseError(#[from] chrono::ParseError),
    #[error("Passport disabled")]
    PassportDisabled,
}

impl IntoResponse for RouteError {
    fn into_response(self) -> axum::response::Response {
        match self {
            RouteError::Web(err) => err.into_response(),
            RouteError::UserNotFound => (StatusCode::NOT_FOUND, "User not found").into_response(),
            RouteError::Unauthorized => (StatusCode::UNAUTHORIZED, "Unauthorized").into_response(),
            RouteError::BadRequest => (StatusCode::BAD_REQUEST, "Bad request").into_response(),
            RouteError::PassportDisabled => {
                (StatusCode::FORBIDDEN, self.to_string()).into_response()
            }
            _ => (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Internal server error: {self}"),
            )
                .into_response(),
        }
    }
}

/// TODO: Write a macro for this
pub mod scope {
    use std::ops::BitOr;

    use oxide_auth::endpoint;

    use super::*;
    #[derive(Debug, PartialEq, Eq, ConstParamTy)]
    pub struct Scope(u64);

    impl BitOr for Scope {
        type Output = Self;

        fn bitor(self, rhs: Self) -> Self::Output {
            Self(self.0 | rhs.0)
        }
    }

    /// This MUST be written in order with the below consts
    const STRINGS: [&str; 4] = ["user:read", "user", "admin:read", "admin"];

    pub const USER_READ: Scope = Scope(0b1);
    pub const USER: Scope = Scope(0b10);
    pub const ADMIN_READ: Scope = Scope(0b100);
    pub const ADMIN: Scope = Scope(0b1000);

    impl Scope {
        pub fn names(&self) -> Vec<endpoint::Scope> {
            STRINGS
                .iter()
                .enumerate()
                .filter(|(pos, _)| self.0 & (1 << pos) != 0)
                .map(|(_, name)| name.parse().expect("valid scope"))
                .collect()
        }
    }
}

pub trait NewSolicitor {
    fn new() -> Self;
}

impl NewSolicitor for Vacant {
    fn new() -> Self {
        Self
    }
}

pub mod oauser {
    use super::*;
    pub struct OAuthUser<const S: scope::Scope, SL: NewSolicitor> {
        pub id: i32,
        _sl: PhantomData<SL>,
    }

    impl<const S: scope::Scope, SL: NewSolicitor> OAuthUser<S, SL> {
        pub fn new(id: i32) -> Self {
            Self {
                id,
                _sl: PhantomData,
            }
        }
    }
}

impl<const S: scope::Scope, SL: NewSolicitor> FromRequestParts<RouteState> for OAuthUser<S, SL> {
    type Rejection = RouteError;
    async fn from_request_parts(
        parts: &mut axum::http::request::Parts,
        state: &RouteState,
    ) -> Result<Self, Self::Rejection> {
        let resource = OAuthResource::from_request_parts(parts, state).await?;
        let user = ResourceFlow::prepare(OAuthEndpoint::new(
            Vacant,
            S.names(),
            state.issuer.clone(),
            state.authorizer.clone(),
        ))?
        .execute(resource.into())
        .await
        .map_err(|e| e.expect_err("Received oauth response when expected error on bad data"))?;

        Ok(OAuthUser::new(
            user.client_id.parse().expect("valid user id"),
        ))
    }
}
