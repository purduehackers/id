use id::{wrap_error, oauth_user, db};
use vercel_runtime::{run, Body, Error, Request, Response};
use entity::{
    passport,
    prelude::*,
};
use sea_orm::{prelude::*, ActiveValue, IntoActiveModel};

#[tokio::main]
async fn main() -> Result<(), Error> {
    run(wrap_error!(handler)).await
}

pub async fn handler(req: Request) -> Result<Response<Body>, Error> {
    let id: i32 = req.uri().path().split('/').last().expect("id path component").parse().expect("valid id");
    let _user = oauth_user(req, vec!["admin".parse().expect("scope to parse")]).await?;

    let db = db().await?;

    let passport: Option<passport::Model> = Passport::find_by_id(id).one(&db).await?;

    let passport = passport.ok_or("Passport does not exist".to_string())?;

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

    Ok(Response::new(Body::Empty))
}
