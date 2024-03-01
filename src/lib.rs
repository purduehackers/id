#![deny(clippy::unwrap_used)]

use core::ops::Deref;
use fred::prelude::*;
use lambda_http::http::{
    header::{CONTENT_TYPE, LOCATION, WWW_AUTHENTICATE},
    HeaderValue,
};
use sea_orm::{Database, DatabaseConnection};
use serde::Serialize;
use std::{borrow::Cow, env, fmt::Display, ops::DerefMut, str::FromStr};
use vercel_runtime::{Body, Request, Response, StatusCode};

use chrono::{Months, Utc};
use entity::prelude::*;
use entity::{auth_grant, auth_token};
use oxide_auth::{endpoint::ResponseStatus, frontends};
use oxide_auth::{
    endpoint::{NormalizedParameter, Scope, WebRequest, WebResponse},
    frontends::{
        dev::Url,
        simple::endpoint::{Generic, Vacant},
    },
    primitives::{
        authorizer::AuthMap,
        generator::RandomGenerator,
        issuer::TokenMap,
        registrar::{Client, ClientMap, RegisteredUrl},
    },
};
use oxide_auth_async::primitives::{Authorizer, Issuer};
use oxide_auth_async::{endpoint::Endpoint, endpoint::OwnerSolicitor};
use rand::distributions::{Alphanumeric, DistString};
use sea_orm::{prelude::*, ActiveValue};
use sea_orm::{Condition, IntoActiveModel};

use thiserror::Error;

pub mod tfa;

#[derive(Debug, Error)]
pub enum Error {
    #[error("Invalid body type")]
    InvalidBodyType,
}

#[derive(Debug, Default)]
pub struct ResponseCompat(pub Response<vercel_runtime::Body>);

impl Deref for ResponseCompat {
    type Target = Response<vercel_runtime::Body>;
    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl DerefMut for ResponseCompat {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.0
    }
}

impl From<ResponseCompat> for Response<vercel_runtime::Body> {
    fn from(value: ResponseCompat) -> Self {
        value.0
    }
}

impl WebResponse for ResponseCompat {
    type Error = vercel_runtime::Error;

    fn ok(&mut self) -> Result<(), Self::Error> {
        *self.status_mut() = StatusCode::OK;
        Ok(())
    }

    fn body_text(&mut self, text: &str) -> Result<(), Self::Error> {
        self.headers_mut().insert(
            CONTENT_TYPE,
            HeaderValue::from_str("text/plain").expect("header to be valid"),
        );
        *self.body_mut() = Body::Text(text.to_owned());

        Ok(())
    }

    fn body_json(&mut self, data: &str) -> Result<(), Self::Error> {
        self.headers_mut().insert(
            CONTENT_TYPE,
            HeaderValue::from_str("application/json").expect("header to be valid"),
        );
        *self.body_mut() = Body::Text(data.to_owned());

        Ok(())
    }

    fn redirect(&mut self, url: Url) -> Result<(), Self::Error> {
        self.headers_mut().insert(
            LOCATION,
            HeaderValue::from_str(url.as_ref()).expect("header to be valid"),
        );
        *self.status_mut() = StatusCode::SEE_OTHER;

        Ok(())
    }

    fn client_error(&mut self) -> Result<(), Self::Error> {
        *self.status_mut() = StatusCode::BAD_REQUEST;

        Ok(())
    }

    fn unauthorized(&mut self, header_value: &str) -> Result<(), Self::Error> {
        self.headers_mut().insert(
            WWW_AUTHENTICATE,
            HeaderValue::from_str(header_value).expect("header to be valid"),
        );
        *self.status_mut() = StatusCode::UNAUTHORIZED;

        Ok(())
    }
}

#[derive(Debug)]
pub struct RequestCompat(pub Request);

impl Deref for RequestCompat {
    type Target = Request;
    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl DerefMut for RequestCompat {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.0
    }
}

impl From<RequestCompat> for Request {
    fn from(value: RequestCompat) -> Self {
        value.0
    }
}

impl WebRequest for RequestCompat {
    type Error = vercel_runtime::Error;
    type Response = ResponseCompat;
    fn authheader(&mut self) -> Result<Option<std::borrow::Cow<str>>, Self::Error> {
        Ok(self.headers().iter().find_map(|(k, v)| {
            if k == "Authorization" {
                Some(Cow::Borrowed(v.to_str().expect("head to be valid string")))
            } else {
                None
            }
        }))
    }

    fn urlbody(
        &mut self,
    ) -> Result<std::borrow::Cow<dyn oxide_auth::endpoint::QueryParameter + 'static>, Self::Error>
    {
        let body: &Body = self.body();

        let encoded = match body {
            Body::Empty => return Err(Box::new(Error::InvalidBodyType)),
            Body::Binary(b) => {
                let encoded = form_urlencoded::parse(b); 

                encoded
            }
            Body::Text(t) => {
                let encoded = form_urlencoded::parse(t.as_bytes());

                encoded
            }
        };

        let mut body = NormalizedParameter::new();

        for (k, v) in encoded {
            body.insert_or_poison(Cow::Owned(k.to_string()), Cow::Owned(v.to_string()));
        }

        Ok(Cow::Owned(body))
    }

    fn query(
        &mut self,
    ) -> Result<std::borrow::Cow<dyn oxide_auth::endpoint::QueryParameter + 'static>, Self::Error>
    {
        let url = url::Url::parse(&self.uri().to_string())?;

        let mut params = NormalizedParameter::new();

        for (k, v) in url.query_pairs() {
            params.insert_or_poison(Cow::Owned(k.to_string()), Cow::Owned(v.to_string()));
        }

        Ok(Cow::Owned(params))
    }
}

pub const VALID_CLIENTS: [&str; 3] = ["dashboard", "passports", "authority"];

pub fn client_registry() -> ClientMap {
    let mut clients = ClientMap::new();
    clients.register_client(Client::public(
        VALID_CLIENTS[0],
        RegisteredUrl::Semantic(
            Url::from_str("https://dash.purduehackers.com/callback").expect("url to be valid"),
        ),
        "read".parse().expect("scope to be valid"),
    ));

    clients.register_client(Client::public(
        VALID_CLIENTS[1],
        RegisteredUrl::Semantic(
            Url::from_str("https://passports.purduehackers.com/callback").expect("url to be valid"),
        ),
        "read write".parse().expect("scopes to be valid"),
    ));

    clients.register_client(Client::public(
        VALID_CLIENTS[2],
        RegisteredUrl::Semantic(Url::from_str("authority://callback").expect("url to be valid")),
        "read write".parse().expect("scopes to be valid"),
    ));

    clients
}

pub fn generic_endpoint<S>(
    solicitor: S,
) -> Generic<ClientMap, AuthMap<RandomGenerator>, TokenMap<RandomGenerator>, S, Vec<Scope>, Vacant>
{
    Generic {
        registrar: client_registry(),
        authorizer: AuthMap::new(RandomGenerator::new(16)),
        issuer: TokenMap::new(RandomGenerator::new(16)),
        solicitor,
        scopes: vec!["read".parse().expect("scope to be valid")],
        response: Vacant,
    }
}

#[derive(Serialize)]
pub struct APIError<'a> {
    pub message: &'a str,
    pub code: &'a str,
}

pub async fn kv() -> Result<RedisClient, vercel_runtime::Error> {
    let config = RedisConfig::from_url(
        &env::var("KV_URL")
            .expect("KV_URL env var to be present")
            .replace("redis://", "rediss://"),
    )?;
    let c = Builder::from_config(config).build()?;
    c.init().await?;
    Ok(c)
}
pub async fn db() -> Result<DatabaseConnection, vercel_runtime::Error> {
    let db = Database::connect(
        env::var("POSTGRES_URL_NON_POOLING").expect("Database URL var to be present"),
    )
    .await?;
    use migration::{Migrator, MigratorTrait};
    Migrator::up(&db, None).await?;

    Ok(db)
}

/// Vercel makes me do this
pub fn map_error_to_readable<E: Display>(r: Result<Response<Body>, E>) -> Response<Body> {
    match r {
        Ok(r) => r,
        Err(e) => {
            let error = format!("Server Error: {e}");
            println!("{}", &error);
            let mut resp = Response::new(Body::Text(error));
            *resp.status_mut() = StatusCode::INTERNAL_SERVER_ERROR;
            resp
        }
    }
}

#[derive(Debug, serde::Deserialize)]
pub struct PassportRecord {
    pub id: i32,
    pub secret: String,
}

#[macro_export]
macro_rules! wrap_error {
    ($fn:ident) => {
        move |r| {
            Box::pin(async move {
                let res = $fn(r).await;
                Ok($crate::map_error_to_readable(res))
            })
        }
    };
}

pub struct DbIssuer;

#[async_trait::async_trait]
impl Issuer for DbIssuer {
    async fn issue(
        &mut self,
        grant: oxide_auth::primitives::grant::Grant,
    ) -> Result<oxide_auth::primitives::prelude::IssuedToken, ()> {
        let db = db().await.expect("db connection to exist");

        let grant: auth_grant::Model = AuthGrant::find()
            .filter(
                Condition::all()
                    .add(
                        auth_grant::Column::OwnerId.eq(grant
                            .owner_id
                            .parse::<i32>()
                            .expect("failed to parse owner_id as int")),
                    )
                    .add(auth_grant::Column::ClientId.eq(grant.client_id.clone())),
            )
            .one(&db)
            .await
            .expect("db op to succeed")
            .expect("grant to be there already");

        let new = auth_token::ActiveModel {
            id: ActiveValue::NotSet,
            grant_id: ActiveValue::Set(grant.id),
            token: ActiveValue::Set(Alphanumeric.sample_string(&mut rand::thread_rng(), 32)),
            until: ActiveValue::Set((Utc::now() + Months::new(1)).into()),
        };

        let new = new.insert(&db).await.expect("insert op to succeed");
        Ok(oxide_auth::primitives::issuer::IssuedToken {
            refresh: None,
            token: new.token,
            token_type: oxide_auth::primitives::issuer::TokenType::Bearer,
            until: new.until.into(),
        })
    }

    async fn refresh(
        &mut self,
        _: &str,
        _: oxide_auth::primitives::grant::Grant,
    ) -> Result<oxide_auth::primitives::issuer::RefreshedToken, ()> {
        // No refresh tokens
        Err(())
    }

    async fn recover_token(
        &mut self,
        t: &str,
    ) -> Result<Option<oxide_auth::primitives::grant::Grant>, ()> {
        let db = db().await.expect("db to be available");

        let token: Option<auth_token::Model> = AuthToken::find()
            .filter(auth_token::Column::Token.eq(t))
            .one(&db)
            .await
            .expect("db op to succeed");

        Ok(match token {
            Some(t) => {
                let grant: auth_grant::Model = t
                    .find_related(AuthGrant)
                    .one(&db)
                    .await
                    .expect("db op to succeed")
                    .expect("token to have grant parent");

                Some(oxide_auth::primitives::grant::Grant {
                    owner_id: grant.owner_id.to_string(),
                    client_id: grant.client_id,
                    scope: serde_json::from_value(grant.scope).expect("scope to be valid object"),
                    extensions: Default::default(),
                    redirect_uri: serde_json::from_value(grant.redirect_uri)
                        .expect("redirect_uri to be valid object"),
                    until: grant.until.into(),
                })
            }
            None => None,
        })
    }

    async fn recover_refresh(
        &mut self,
        _: &str,
    ) -> Result<Option<oxide_auth::primitives::grant::Grant>, ()> {
        // No refresh tokens
        Err(())
    }
}

pub struct DbAuthorizer;

#[async_trait::async_trait]
impl Authorizer for DbAuthorizer {
    async fn authorize(
        &mut self,
        grant: oxide_auth::primitives::grant::Grant,
    ) -> Result<String, ()> {
        let db = db().await.expect("db to be accessible");

        let existing: Option<auth_grant::Model> = AuthGrant::find()
            .filter(
                Condition::all()
                    .add(
                        auth_grant::Column::OwnerId.eq(grant
                            .owner_id
                            .parse::<i32>()
                            .expect("failed to parse owner_id as int")),
                    )
                    .add(auth_grant::Column::ClientId.eq(grant.client_id.clone())),
            )
            .one(&db)
            .await
            .expect("db op to succeed");

        if let Some(existing) = existing {
            let mut active = existing.into_active_model();
            active.until = ActiveValue::Set(grant.until.into());

            let active = active.update(&db).await.expect("db update op to succeed");
            return Ok(active.code);
        }

        let model = auth_grant::ActiveModel {
            id: ActiveValue::NotSet,
            owner_id: ActiveValue::Set(
                grant
                    .owner_id
                    .parse()
                    .expect("failed to parse owner_id as int"),
            ),
            client_id: ActiveValue::Set(grant.client_id),
            redirect_uri: ActiveValue::Set(
                serde_json::to_value(grant.redirect_uri).expect("url value error"),
            ),
            until: ActiveValue::Set(grant.until.into()),
            scope: ActiveValue::Set(
                serde_json::to_value(grant.scope).expect("scope to be serializable"),
            ),
            code: ActiveValue::Set(Alphanumeric.sample_string(&mut rand::thread_rng(), 32)),
        };

        let grant = model.insert(&db).await.expect("insert to work");
        Ok(grant.code)
    }

    async fn extract(
        &mut self,
        token: &str,
    ) -> Result<Option<oxide_auth::primitives::grant::Grant>, ()> {
        let db = db().await.expect("db to be accessible");

        let grant: Option<auth_grant::Model> = AuthGrant::find()
            .filter(auth_grant::Column::Code.eq(token.to_string()))
            .one(&db)
            .await
            .expect("db op to not fail");

        println!("EXTRACT FUNCTION: {grant:#?}");

        Ok(grant.map(|g| oxide_auth::primitives::grant::Grant {
            client_id: g.client_id,
            extensions: Default::default(),
            owner_id: g.owner_id.to_string(),
            scope: serde_json::from_value(g.scope).expect("scope to be deserializable"),
            redirect_uri: serde_json::from_value(g.redirect_uri)
                .expect("redirect uri to be deserializable"),
            until: g.until.into(),
        }))
    }
}

pub struct OAuthEndpoint<T: OwnerSolicitor<RequestCompat>> {
    solicitor: T,
    scopes: Vec<Scope>,
    registry: ClientMap,
    issuer: DbIssuer,
    authorizer: DbAuthorizer,
}

impl<T: OwnerSolicitor<RequestCompat>> OAuthEndpoint<T> {
    pub fn new(solicitor: T) -> Self {
        Self {
            solicitor,
            scopes: vec!["read".parse().expect("unable to parse scope")],
            registry: client_registry(),
            issuer: DbIssuer,
            authorizer: DbAuthorizer,
        }
    }
}

#[async_trait::async_trait]
impl<T: OwnerSolicitor<RequestCompat> + Send> Endpoint<RequestCompat> for OAuthEndpoint<T> {
    type Error = vercel_runtime::Error;

    fn web_error(&mut self, err: <RequestCompat as WebRequest>::Error) -> Self::Error {
        format!("OAuth Web Error: {err}").into()
    }

    fn error(&mut self, err: frontends::dev::OAuthError) -> Self::Error {
        format!("OAuth Error: {err}").into()
    }

    fn owner_solicitor(&mut self) -> Option<&mut (dyn OwnerSolicitor<RequestCompat> + Send)> {
        Some(&mut self.solicitor)
    }

    fn scopes(&mut self) -> Option<&mut dyn oxide_auth::endpoint::Scopes<RequestCompat>> {
        Some(&mut self.scopes)
    }

    fn response(
        &mut self,
        _request: &mut RequestCompat,
        mut kind: oxide_auth::endpoint::Template,
    ) -> Result<<RequestCompat as WebRequest>::Response, Self::Error> {
        if let Some(e) = kind.authorization_error() {
            return Err(format!("Auth error: {e:?}").into());
        } else if let Some(e) = kind.access_token_error() {
            return Err(format!("Access token error: {e:?}").into());
        }

        match kind.status() {
            ResponseStatus::Ok | ResponseStatus::Redirect => {
                Ok(ResponseCompat(Response::new(Body::Empty)))
            }
            ResponseStatus::BadRequest => Err("Bad request".to_string().into()),
            ResponseStatus::Unauthorized => Err("Unauthorized".to_string().into()),
        }
    }

    fn registrar(&self) -> Option<&(dyn oxide_auth_async::primitives::Registrar + Sync)> {
        Some(&self.registry)
    }

    fn issuer_mut(&mut self) -> Option<&mut (dyn oxide_auth_async::primitives::Issuer + Send)> {
        Some(&mut self.issuer)
    }

    fn authorizer_mut(
        &mut self,
    ) -> Option<&mut (dyn oxide_auth_async::primitives::Authorizer + Send)> {
        Some(&mut self.authorizer)
    }
}
