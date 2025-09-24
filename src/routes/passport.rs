use axum::{Json, extract::State};
use entity::{passport, prelude::*};
use oxide_auth::frontends::simple::endpoint::Vacant;
use sea_orm::prelude::*;

use crate::routes::{RouteError, RouteState, oauser::OAuthUser, scope::ADMIN_READ};

pub async fn handler(
    _user: OAuthUser<{ ADMIN_READ }, Vacant>,
    State(RouteState { db, .. }): State<RouteState>,
) -> Result<Json<Vec<passport::Model>>, RouteError> {
    let all_passports: Vec<passport::Model> = Passport::find().all(&db).await?;

    Ok(Json(all_passports))
}
