use axum::extract::State;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;
use entity::passport;
use entity::prelude::*;
use sea_orm::prelude::*;

use crate::routes::RouteError;
use crate::routes::RouteState;
use crate::PassportRecord;

pub async fn handler(
    Json(record): Json<PassportRecord>,
    State(s): State<RouteState>,
) -> Result<impl IntoResponse, RouteError> {
    // Check if the passport exists and is valid
    let passport: Option<passport::Model> = Passport::find_by_id(record.id).one(&s.db).await?;

    match passport {
        Some(passport) => {
            if !passport.activated {
                Ok((StatusCode::FORBIDDEN, "Passport disabled"))
            } else if passport.secret != record.secret {
                Ok((StatusCode::UNAUTHORIZED, "Passport secret incorrect"))
            } else {
                Ok((StatusCode::OK, ""))
            }
        }
        None => Ok((StatusCode::NOT_FOUND, "Passport does not exist")),
    }
}
