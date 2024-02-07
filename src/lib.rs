use core::ops::Deref;
use lambda_http::http::{
    header::{CONTENT_TYPE, LOCATION, WWW_AUTHENTICATE},
    HeaderValue,
};
use sea_orm::{Database, DatabaseConnection};
use serde::Serialize;
use std::{borrow::Cow, env, ops::DerefMut, str::FromStr, fmt::Display};
use vercel_runtime::{Body, Request, Response, StatusCode};
use fred::prelude::*;

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

use thiserror::Error;

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

        match body {
            Body::Empty | Body::Binary(_) => Err(Box::new(Error::InvalidBodyType)),
            Body::Text(t) => {
                let encoded = form_urlencoded::parse(t.as_bytes());

                let mut body = NormalizedParameter::new();

                for (k, v) in encoded {
                    body.insert_or_poison(Cow::Owned(k.to_string()), Cow::Owned(v.to_string()));
                }

                Ok(Cow::Owned(body))
            }
        }
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

pub fn client_registry() -> ClientMap {
    let mut clients = ClientMap::new();
    clients.register_client(Client::public(
        "dashboard",
        RegisteredUrl::Semantic(Url::from_str("https://dash.purduehackers.com/callback").unwrap()),
        "read".parse().unwrap(),
    ));

    clients.register_client(Client::public(
        "passports",
        RegisteredUrl::Semantic(
            Url::from_str("https://passports.purduehackers.com/callback").unwrap(),
        ),
        "read write".parse().unwrap(),
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
    let config = RedisConfig::from_url(&env!("KV_URL").to_string().replace("redis://", "rediss://"))?;
    let c = Builder::from_config(config).build()?;
    c.init().await?;
    Ok(c)
}
pub async fn db() -> Result<DatabaseConnection, vercel_runtime::Error> {
    let db = Database::connect(env!("DATABASE_URL"))
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
            let mut resp = Response::new(Body::Text(format!("Server Error: {e}")));
            *resp.status_mut() = StatusCode::INTERNAL_SERVER_ERROR;
            resp
        }
    }
}
