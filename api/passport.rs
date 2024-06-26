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
    let _user = oauth_user(req, vec!["admin:read".parse().expect("scope to parse")]).await?;

    let db = db().await?;

    let all_passports: Vec<passport::Model> = Passport::find().all(&db).await?;

    Ok(Response::new(Body::Text(serde_json::to_string(&all_passports).expect("convert passports to string array"))))
}
