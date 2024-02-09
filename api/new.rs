use std::str::FromStr;

use entity::{
    passport::{self},
    prelude::*,
    sea_orm_active_enums::RoleEnum,
    user,
};
use id::{db, wrap_error};
use rand::distributions::{Alphanumeric, DistString};
use sea_orm::{prelude::*, ActiveValue, IntoActiveModel, QueryOrder};
use serde_json::json;
use vercel_runtime::{run, Body, Error, Request, Response};

#[tokio::main]
async fn main() -> Result<(), Error> {
    run(wrap_error!(handler)).await
}

#[derive(Debug, serde::Deserialize)]
struct NewPassport {
    discord_id: String,
    name: String,
    surname: String,
    date_of_birth: String,
    date_of_issue: String,
    place_of_origin: String,
}

const CURRENT_PASSPORT_VERSION: i32 = 0;

fn parse_date(s: &str) -> Result<ChronoDate, Error> {
    if let Ok(date) = ChronoDate::from_str(s) {
        return Ok(date);
    }
    Ok(ChronoDateTime::parse_from_str(s, "%+")?.date())
}

async fn create_new_passport(
    db: &DatabaseConnection,
    user: &user::Model,
    new: NewPassport,
) -> Result<passport::Model, Error> {
    let passport = passport::ActiveModel {
        id: ActiveValue::NotSet,
        owner_id: ActiveValue::Set(user.id),
        name: ActiveValue::Set(new.name),
        surname: ActiveValue::Set(new.surname),
        date_of_birth: ActiveValue::Set(parse_date(&new.date_of_birth)?),
        date_of_issue: ActiveValue::Set(parse_date(&new.date_of_issue)?),
        place_of_origin: ActiveValue::Set(new.place_of_origin),
        version: ActiveValue::Set(CURRENT_PASSPORT_VERSION),
        activated: ActiveValue::Set(false),
        secret: ActiveValue::Set(Alphanumeric.sample_string(&mut rand::thread_rng(), 32)),
    };

    let new_passport = passport.insert(db).await?;

    Ok(new_passport)
}

pub async fn handler(req: Request) -> Result<Response<Body>, Error> {
    match req.body() {
        Body::Text(_) | Body::Empty => Err("Invalid body".to_string().into()),
        Body::Binary(b) => {
            let t = String::from_utf8(b.to_vec()).map_err(|e| format!("Bad UTF-8 encoding! Couldn't convert to text: {e}"))?;
            let new: NewPassport = serde_json::from_str(&t).map_err(|e| format!("Bad JSON encoding! Couldn't convert to passport data: [{e}]: {t}"))?;
            let discord_id = new.discord_id.parse().map_err(|e| format!("Couldn't parse Discord ID! [{e}] {}", new.discord_id))?;

            let db = db().await?;

            let user: Option<user::Model> = User::find()
                .filter(user::Column::DiscordId.eq(discord_id))
                .one(&db)
                .await?;

            let user = match user {
                Some(u) => u,
                None => {
                    let model = user::ActiveModel {
                        id: ActiveValue::NotSet,
                        discord_id: ActiveValue::Set(discord_id),
                        role: ActiveValue::Set(RoleEnum::Hacker),
                        totp: ActiveValue::NotSet,
                    };

                    let user: user::Model = model.insert(&db).await?;

                    user
                }
            };

            let latest_passport = Passport::find()
                .filter(passport::Column::OwnerId.eq(user.id))
                .order_by_desc(passport::Column::Id)
                .one(&db)
                .await?;

            let passport_id = match latest_passport {
                Some(mut found_passport) => if found_passport.activated {
                    let new_passport = create_new_passport(&db, &user, new).await?;
                    new_passport.id
                } else {
                    found_passport.name = new.name;
                    found_passport.surname = new.surname;
                    found_passport.date_of_birth = parse_date(&new.date_of_birth)?;
                    found_passport.date_of_issue = parse_date(&new.date_of_issue)?;
                    found_passport.place_of_origin = new.place_of_origin;

                    let active_passport = found_passport.into_active_model();
                    let updated_passport = active_passport.update(&db).await?;

                    updated_passport.id
                },
                None => {
                    let new_passport = create_new_passport(&db, &user, new).await?;
                    new_passport.id
                },
            };

            Ok(Response::builder()
                .header("Content-Type", "application/json")
                .body(
                    json!({
                      "id": passport_id
                    })
                    .to_string()
                    .into(),
                )?)
        }
    }
}
