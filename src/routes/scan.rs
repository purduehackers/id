use std::str::FromStr;

use axum::{extract::State, http::StatusCode, response::IntoResponse, Json};
use entity::{passport, prelude::*, sea_orm_active_enums::RoleEnum, user};
use fred::prelude::*;
use sea_orm::prelude::*;

use crate::{
    routes::{RouteError, RouteState},
    PassportRecord,
};

/// Returns whether the passport is in the KV and is
pub async fn get_handler(req: Request) -> Result<Response<Body>, RouteError> {
    let id: i32 = url::Url::from_str(&req.uri().to_string())
        .expect("URL to be valid")
        .query_pairs()
        .find_map(|(k, v)| if k == "id" { Some(v) } else { None })
        .ok_or("No ID provided!".to_string())?
        .parse()
        .map_err(|e| format!("Failed to convert to passport number! {e}"))?;

    let kv = kv().await?;

    if !kv.exists(id).await? {
        let mut resp = Response::new(Body::Text("Passport not found".to_string()));
        *resp.status_mut() = StatusCode::NOT_FOUND;
        return Ok(resp);
    }

    let ready: bool = kv.get(id).await?;

    let db = db().await?;

    let passport: passport::Model = Passport::find_by_id(id)
        .one(&db)
        .await?
        .expect("Passport to exist");

    if ready {
        let user: user::Model = passport
            .find_related(User)
            .one(&db)
            .await?
            .expect("Passport to have an owner");

        #[derive(Debug, serde::Serialize)]
        struct GetReturn {
            totp_needed: bool,
        }

        Ok(Response::new(Body::Text(serde_json::to_string(
            &GetReturn {
                totp_needed: user.role == RoleEnum::Admin,
            },
        )?)))
    } else {
        let mut resp = Response::new(Body::Text("Invalid secret".to_string()));
        *resp.status_mut() = StatusCode::UNAUTHORIZED;
        Ok(resp)
    }
}

/// Puts data in the KV, with or without a secret
pub async fn post_handler(
    Json(record): Json<PassportRecord>,
    State(RouteState { db, kv, .. }): State<RouteState>,
) -> Result<impl IntoResponse, RouteError> {
    // If the KV has a record with an empty string, someone is trying to auth
    // You may only set the record to the correct secret once its set to an empty record

    let passport: passport::Model = Passport::find_by_id(record.id)
        .one(&db)
        .await?
        .ok_or(RouteError::UserNotFound)?;

    if !passport.activated {
        return Err(RouteError::PassportDisabled);
    }

    // No record currently, so add a record with whatever the secret is supposed to be
    if !kv.exists(passport.id).await? {
        kv.set::<(), _, _>(passport.id, false, Some(Expiration::EX(90)), None, false)
            .await?;
        return Ok((StatusCode::OK, ""));
    }

    // There is a passport, so figure out what it is
    // If it's empty, the only thing it can be updated with is the valid secret of the
    // passport
    // If it's not or there is already a valid secret in the KV, return error
    let current_value: bool = kv.get(passport.id).await?;
    if !current_value && record.secret == passport.secret {
        kv.set::<(), _, _>(passport.id, true, Some(Expiration::EX(60)), None, false)
            .await?;

        Ok((StatusCode::OK, ""))
    } else {
        Err(RouteError::BadRequest)
    }
}
