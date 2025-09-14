use axum::{extract::State, Json};
use entity::{passport, prelude::*, sea_orm_active_enums::RoleEnum, user};
use oxide_auth::frontends::simple::endpoint::Vacant;
use sea_orm::{prelude::*, QueryOrder};
use serde::{Deserialize, Serialize};

use crate::routes::{scope::USER_READ, OAuthUser, RouteError, RouteState};

#[derive(Serialize, Deserialize)]
pub struct UserWithPassport {
    iss: String,
    sub: i32,
    id: i32,
    discord_id: i64,
    role: RoleEnum,
    totp: Option<String>,
    latest_passport: Option<passport::Model>,
}

pub async fn handler(
    OAuthUser { id: user_id, .. }: OAuthUser<{ USER_READ }, Vacant>,
    State(s): State<RouteState>,
) -> Result<Json<UserWithPassport>, RouteError> {
    let user = User::find()
        .filter(user::Column::Id.eq(user_id))
        .one(&s.db)
        .await?
        .ok_or(RouteError::UserNotFound)?;
    let latest_passport = Passport::find()
        .filter(passport::Column::OwnerId.eq(user_id))
        .order_by_desc(passport::Column::Id)
        .one(&s.db)
        .await?;

    let response_data = UserWithPassport {
        iss: "https://id.purduehackers.com".to_owned(),
        sub: user.id,
        id: user.id,
        discord_id: user.discord_id,
        role: user.role.clone(),
        totp: user.totp.clone(),
        latest_passport: latest_passport.clone(),
    };

    Ok(Json(response_data))
}
