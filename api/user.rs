use entity::{passport, prelude::*, sea_orm_active_enums::RoleEnum, user};
use id::{db, oauth_user, wrap_error};
use sea_orm::{prelude::*, QueryOrder};
use serde::{Deserialize, Serialize};
use vercel_runtime::{run, Body, Error, Request, Response};

#[derive(Serialize, Deserialize)]
struct UserWithPassport {
    iss: String,
    sub: i32,
    id: i32,
    discord_id: i64,
    role: RoleEnum,
    totp: Option<String>,
    latest_passport: Option<passport::Model>,
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    run(wrap_error!(handler)).await
}

pub async fn handler(req: Request) -> Result<Response<Body>, Error> {
    let user_id = oauth_user(req, vec!["user:read".parse().expect("valid scope")]).await?;

    let db = db().await?;

    let user = User::find()
        .filter(user::Column::Id.eq(user_id))
        .one(&db)
        .await?
        .ok_or_else(|| Error::from("User not found"))?;
    let latest_passport = Passport::find()
        .filter(passport::Column::OwnerId.eq(user_id))
        .order_by_desc(passport::Column::Id)
        .one(&db)
        .await?;

    let response_data = UserWithPassport {
        iss: "https://id.purduehackers.com".to_owned(),
        sub: user.id,
        id: user.id,
        discord_id: user.discord_id.clone(),
        role: user.role.clone(),
        totp: user.totp.clone(),
        latest_passport: latest_passport.clone(),
    };

    Ok(Response::new(Body::Text(serde_json::to_string(
        &response_data,
    )?)))
}
