use id::{wrap_error, oauth_user, db};
use vercel_runtime::{run, Body, Error, Request, Response};
use entity::{
    passport,
    prelude::*,
};
use sea_orm::prelude::*;

#[tokio::main]
async fn main() -> Result<(), Error> {
    run(wrap_error!(handler)).await
}

pub async fn handler(req: Request) -> Result<Response<Body>, Error> {
    let user = oauth_user(req, vec!["user:read".parse().expect("valid scope")]).await?;

    let db = db().await?;

    let passport = Passport::find().filter(passport::Column::OwnerId.eq(user)).one(&db).await?;

    Ok(Response::new(Body::Text(serde_json::to_string(&passport)?)))
}

