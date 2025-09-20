use axum::extract::{Path, State};
use entity::{passport, prelude::*};
use oxide_auth::frontends::simple::endpoint::Vacant;
use sea_orm::{ActiveValue, IntoActiveModel, prelude::*};

use crate::routes::{RouteError, RouteState, oauser::OAuthUser, scope::ADMIN};

pub async fn handler(
    State(RouteState { db, .. }): State<RouteState>,
    Path(id): Path<i32>,
    _user: OAuthUser<{ ADMIN }, Vacant>,
) -> Result<(), RouteError> {
    let passport: Option<passport::Model> = Passport::find_by_id(id).one(&db).await?;

    let passport = passport.ok_or(RouteError::UserNotFound)?;

    let old_passports: Vec<passport::Model> = Passport::find()
        .filter(passport::Column::OwnerId.eq(passport.owner_id))
        .all(&db)
        .await?
        .into_iter()
        .filter(|p| p.id != passport.id)
        .collect();

    let mut am = passport.into_active_model();
    am.activated = ActiveValue::Set(true);
    am.save(&db).await?;

    for passport in old_passports {
        let mut am = passport.into_active_model();
        am.activated = ActiveValue::Set(false);
        am.save(&db).await?;
    }

    Ok(())
}
