use std::str::FromStr;

use id::{db, wrap_error};
use vercel_runtime::{run, Body, Error, Request, Response, StatusCode};
use sea_orm::{prelude::*, ActiveValue};
use entity::{prelude::*, passport, user, sea_orm_active_enums::RoleEnum};
use rand::distributions::{Alphanumeric, DistString};

#[tokio::main]
async fn main() -> Result<(), Error> {
    run(wrap_error!(handler)).await
}

#[derive(Debug, serde::Deserialize)]
struct NewPassport {
    discord_id: i64,
    name: String,
    surname: String,
    date_of_birth: String,
    date_of_issue: String,
    place_of_origin: String,
}

const CURRENT_PASSPORT_VERSION: i32 = 0;

pub async fn handler(req: Request) -> Result<Response<Body>, Error> {
    match req.body() {
        Body::Text(_) | Body::Empty => Err("Invalid body".to_string().into()),
        Body::Binary(b) => {
            let t = String::from_utf8(b.to_vec())?;
            let new: NewPassport = serde_json::from_str(&t)?;

            let db = db().await?;

            let user: Option<user::Model> = User::find().filter(user::Column::DiscordId.eq(new.discord_id)).one(&db).await?;

            let user = match user {
                Some(u) => u,
                None => {
                    let model = user::ActiveModel {
                        id: ActiveValue::NotSet,
                        discord_id: ActiveValue::Set(new.discord_id),
                        role: ActiveValue::Set(RoleEnum::Hacker),
                        totp: ActiveValue::NotSet,
                    };

                    let user: user::Model = model.insert(&db).await?;

                    user
                }
            };

            let passport = passport::ActiveModel {
                id: ActiveValue::NotSet,
                owner_id: ActiveValue::Set(user.id),
                name: ActiveValue::Set(new.name),
                surname: ActiveValue::Set(new.surname),
                date_of_birth: ActiveValue::Set(ChronoDate::from_str(&new.date_of_birth)?),
                date_of_issue: ActiveValue::Set(ChronoDate::from_str(&new.date_of_issue)?),
                place_of_origin: ActiveValue::Set(new.place_of_origin),
                version: ActiveValue::Set(CURRENT_PASSPORT_VERSION),
                activated: ActiveValue::Set(false),
                secret: ActiveValue::Set(Alphanumeric.sample_string(&mut rand::thread_rng(), 32))
            };

            passport.insert(&db).await?;

            Ok(Response::new(Body::Empty))
        }
    }
}
