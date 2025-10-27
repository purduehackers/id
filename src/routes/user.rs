use axum::{extract::State, Json};
use entity::{passport, prelude::*, sea_orm_active_enums::RoleEnum, user};
use oxide_auth::frontends::simple::endpoint::Vacant;
use sea_orm::{prelude::*, QueryOrder};
use serde::Serialize;

use crate::routes::{scope::USER_READ, OAuthUser, RouteError, RouteState};

#[derive(Serialize)]
struct UserWithPassport {
    iss: String,
    sub: i32,
    id: i32,
    discord_id: i64,
    role: RoleEnum,
    totp: Option<String>,
    latest_passport: Option<PublicPassport>,
}

#[derive(Serialize)]
struct PublicPassport {
    pub id: i32,
    pub version: i32,
    pub surname: String,
    pub name: String,
    pub date_of_birth: Date,
    pub date_of_issue: Date,
    pub place_of_origin: String,
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
        latest_passport: latest_passport.map(
            |entity::passport::Model {
                 id,
                 version,
                 surname,
                 name,
                 date_of_birth,
                 date_of_issue,
                 place_of_origin,
                 ..
             }| PublicPassport {
                id,
                version,
                surname,
                name,
                date_of_birth,
                date_of_issue,
                place_of_origin,
            },
        ),
    };

    Ok(Json(response_data))
}
