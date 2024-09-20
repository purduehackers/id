use id::{wrap_error, oauth_user, db};
use serde::{
    Serialize,
    Deserialize
};
use vercel_runtime::{run, Body, Error, Request, Response};
use entity::{
    passport, prelude::*, sea_orm_active_enums::RoleEnum, user
};
use sea_orm::prelude::*;

#[derive(Serialize, Deserialize)]
struct UserWithPassport {
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

    let user = User::find().filter(user::Column::Id.eq(user_id)).one(&db).await?.ok_or_else(|| Error::from("User not found"))?;
    let latest_passport = Passport::find().filter(passport::Column::OwnerId.eq(user_id)).one(&db).await?;

    let response_data = UserWithPassport {
        id: user.id,
        discord_id: user.discord_id.clone(),
        role: user.role.clone(),
        totp: user.totp.clone(),
        latest_passport: latest_passport.clone()
    };

    Ok(Response::new(Body::Text(serde_json::to_string(&response_data)?)))
}

