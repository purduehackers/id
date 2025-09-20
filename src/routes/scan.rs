use entity::{passport, prelude::*, sea_orm_active_enums::RoleEnum, user};
use fred::prelude::*;
use leptos::prelude::expect_context;
use sea_orm::prelude::*;

use crate::routes::{RouteError, RouteState};

/// Returns whether the passport is in the KV and TOTP needed
pub async fn get_handler(id: i32) -> Result<bool, RouteError> {
    let RouteState { db, kv, .. } = expect_context();

    if !kv.exists(id).await? {
        return Err(RouteError::UserNotFound);
    }

    let ready: bool = kv.get(id).await?;

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

        Ok(user.role == RoleEnum::Admin)
    } else {
        Err(RouteError::Unauthorized)
    }
}

/// Puts data in the KV, with or without a secret
pub async fn post_handler(id: i32, secret: String) -> Result<(), RouteError> {
    // If the KV has a record with an empty string, someone is trying to auth
    // You may only set the record to the correct secret once its set to an empty record
    let RouteState { db, kv, .. } = expect_context::<RouteState>();

    let passport: passport::Model = Passport::find_by_id(id)
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
        return Ok(());
    }

    // There is a passport, so figure out what it is
    // If it's empty, the only thing it can be updated with is the valid secret of the
    // passport
    // If it's not or there is already a valid secret in the KV, return error
    let current_value: bool = kv.get(passport.id).await?;
    if !current_value && secret == passport.secret {
        kv.set::<(), _, _>(passport.id, true, Some(Expiration::EX(60)), None, false)
            .await?;

        Ok(())
    } else {
        Err(RouteError::BadRequest)
    }
}
