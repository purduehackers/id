use std::str::FromStr;

use axum::{extract::State, Json};
use entity::{
    passport::{self},
    prelude::*,
    sea_orm_active_enums::RoleEnum,
    user,
};
use rand::distributions::{Alphanumeric, DistString};
use sea_orm::{prelude::*, ActiveValue, IntoActiveModel, QueryOrder};

use crate::routes::{RouteError, RouteState};

#[derive(Debug, serde::Deserialize)]
pub struct NewPassport {
    discord_id: String,
    name: String,
    surname: String,
    date_of_birth: String,
    date_of_issue: String,
    place_of_origin: String,
    ceremony_time: String,
}

const CURRENT_PASSPORT_VERSION: i32 = 1;

fn parse_date(s: &str) -> Result<ChronoDate, RouteError> {
    if let Ok(date) = ChronoDate::from_str(s) {
        return Ok(date);
    }
    Ok(ChronoDateTime::parse_from_str(s, "%+")?.date())
}

fn parse_datetime(s: &str) -> Result<ChronoDateTime, RouteError> {
    if let Ok(datetime) = ChronoDateTime::from_str(s) {
        return Ok(datetime);
    }
    Ok(ChronoDateTime::parse_from_str(s, "%+")?)
}

async fn create_new_passport(
    db: &DatabaseConnection,
    user: &user::Model,
    new: NewPassport,
) -> Result<passport::Model, RouteError> {
    let passport = passport::ActiveModel {
        id: ActiveValue::NotSet,
        owner_id: ActiveValue::Set(user.id),
        name: ActiveValue::Set(new.name),
        surname: ActiveValue::Set(new.surname),
        date_of_birth: ActiveValue::Set(parse_date(&new.date_of_birth)?),
        date_of_issue: ActiveValue::Set(parse_date(&new.date_of_issue)?),
        place_of_origin: ActiveValue::Set(new.place_of_origin),
        ceremony_time: ActiveValue::Set(parse_datetime(&new.ceremony_time)?),
        version: ActiveValue::Set(CURRENT_PASSPORT_VERSION),
        activated: ActiveValue::Set(false),
        secret: ActiveValue::Set(Alphanumeric.sample_string(&mut rand::thread_rng(), 32)),
    };

    let new_passport = passport.insert(db).await?;

    Ok(new_passport)
}

pub struct PassportId {
    pub id: i32,
}

pub async fn handler(
    Json(new): Json<NewPassport>,
    State(RouteState { db, .. }): State<RouteState>,
) -> Result<Json<PassportId>, RouteError> {
    let discord_id = new.discord_id.parse().map_err(|_| RouteError::BadRequest)?;

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
        Some(found_passport) => {
            if found_passport.activated {
                let new_passport = create_new_passport(&db, &user, new).await?;
                new_passport.id
            } else {
                let mut active_passport = found_passport.into_active_model();

                active_passport.name = ActiveValue::Set(new.name);
                active_passport.surname = ActiveValue::Set(new.surname);
                active_passport.date_of_birth = ActiveValue::Set(parse_date(&new.date_of_birth)?);
                active_passport.date_of_issue = ActiveValue::Set(parse_date(&new.date_of_issue)?);
                active_passport.place_of_origin = ActiveValue::Set(new.place_of_origin);
                active_passport.ceremony_time =
                    ActiveValue::Set(parse_datetime(&new.ceremony_time)?);

                let updated_passport = active_passport.update(&db).await?;

                updated_passport.id
            }
        }
        None => {
            let new_passport = create_new_passport(&db, &user, new).await?;
            new_passport.id
        }
    };

    Ok(Json(PassportId { id: passport_id }))
}
