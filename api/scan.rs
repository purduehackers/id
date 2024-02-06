use std::str::FromStr;

use id::{kv, db};
use lambda_http::http::Method;
use redis::AsyncCommands;
use serde_json::json;
use vercel_runtime::{run, Body, Error, Request, Response, StatusCode};
use sea_orm::prelude::*;
use entity::{prelude::*, passport, user, sea_orm_active_enums::RoleEnum};

#[tokio::main]
async fn main() -> Result<(), Error> {
    run(handler).await
}

pub async fn handler(req: Request) -> Result<Response<Body>, Error> {
    if req.method() == Method::POST {
        post_handler(req).await
    } else {
        get_handler(req).await
    }
}

/// Returns whether the passport is in the KV and is 
pub async fn get_handler(req: Request) -> Result<Response<Body>, Error> {
    let id: i32 = url::Url::from_str(&req.uri().to_string())
        .expect("URL to be valid")
        .query_pairs()
        .find_map(|(k, v)| if k == "id" { Some(v) } else { None })
        .ok_or("No ID provided!".to_string())?.parse().map_err(|e| format!("Failed to convert to passport number! {e}"))?;

    let mut kv = kv().await?;

    if !kv.exists(id).await? {
        let mut resp = Response::new(Body::Text("Passport not found".to_string()));
        *resp.status_mut() = StatusCode::NOT_FOUND;
        return Ok(resp);
    }

    let secret: String = kv.get(id).await?;

    if secret.is_empty() {
        let mut resp = Response::new(Body::Empty);
        *resp.status_mut() = StatusCode::NO_CONTENT;
        return Ok(resp);
    }

    let db = db().await?;

    let passport: passport::Model = Passport::find_by_id(id).one(&db).await?.expect("Passport to exist");

    if secret == passport.secret {
        let user: user::Model = User::find_by_id(passport.owner_id).one(&db).await?.expect("Passport to have an owner");
        
        #[derive(Debug, serde::Serialize)]
        struct GetReturn {
            totp_needed: bool,
        }

        Ok(Response::new(Body::Text(serde_json::to_string(&GetReturn {
            totp_needed: user.role == RoleEnum::Admin,
        })?)))
    } else {
        let mut resp = Response::new(Body::Text("Invalid secret".to_string()));
        *resp.status_mut() = StatusCode::UNAUTHORIZED;
        Ok(resp)
    }
}

/// Puts data in the KV, with or without a secret
pub async fn post_handler(req: Request) -> Result<Response<Body>, Error> {
    todo!()
}
