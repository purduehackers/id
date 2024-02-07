use std::str::FromStr;

use id::{kv, db, map_error_to_readable};
use lambda_http::http::Method;
use serde_json::json;
use vercel_runtime::{run, Body, Error, Request, Response, StatusCode};
use sea_orm::prelude::*;
use entity::{prelude::*, passport, user, sea_orm_active_enums::RoleEnum};
use fred::prelude::*;

#[tokio::main]
async fn main() -> Result<(), Error> {
    run(handler).await
}

pub async fn handler(req: Request) -> Result<Response<Body>, Error> {
    let res = if req.method() == Method::POST {
        post_handler(req).await
    } else {
        get_handler(req).await
    };

    Ok(map_error_to_readable(res))
}

/// Returns whether the passport is in the KV and is 
pub async fn get_handler(req: Request) -> Result<Response<Body>, Error> {
    let id: i32 = url::Url::from_str(&req.uri().to_string())
        .expect("URL to be valid")
        .query_pairs()
        .find_map(|(k, v)| if k == "id" { Some(v) } else { None })
        .ok_or("No ID provided!".to_string())?.parse().map_err(|e| format!("Failed to convert to passport number! {e}"))?;

    let kv = kv().await?;

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
        let user: user::Model = passport.find_related(User).one(&db).await?.expect("Passport to have an owner");
        
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
    match req.body() {
        Body::Binary(_) | Body::Empty => Err("Invalid method".to_string().into()),
        Body::Text(t) => {
            #[derive(Debug, serde::Deserialize)]
            struct PassportRecord {
                id: i32,
                secret: String,
            }

            let record: PassportRecord = serde_json::from_str(t)?;

            let db = db().await?;
            let kv = kv().await?;

            // If the KV has a record with an empty string, someone is trying to auth
            // You may only set the record to the correct secret once its set to an empty record
            
            let passport: passport::Model = Passport::find_by_id(record.id).one(&db).await?.ok_or("Invalid passport ID".to_string())?;

            // No record currently, so add a record with whatever the secret is supposed to be
            if !kv.exists(passport.id).await? {
                kv.set(passport.id, false, Some(Expiration::EX(300)), None, false).await?;
                return Ok(Response::new(Body::Empty));
            }

            // There is a passport, so figure out what it is
            // If it's empty, the only thing it can be updated with is the valid secret of the
            // passport
            // If it's not or there is already a valid secret in the KV, return error
            let current_value: bool = kv.get(passport.id).await?;
            if !current_value && record.secret == passport.secret {
                kv.set(passport.id, true, Some(Expiration::EX(60)), None, false).await?;

                Ok(Response::new(Body::Empty))
            } else {
                let mut resp = Response::new(Body::Text("Invalid KV request".to_string()));
                *resp.status_mut() = StatusCode::BAD_REQUEST;
                Ok(resp)
            }
        },
    }
}

