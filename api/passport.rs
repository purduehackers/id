use id::{wrap_error, OAuthEndpoint, RequestCompat, oauth_resource, db};
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
    oauth_resource(req, vec!["admin:read".parse().expect("scope to parse")]).await?;

    let db = db().await?;

    let all_passports: Vec<passport::Model> = Passport::find().all(&db).await?;

    Ok(Response::new(Body::Text(serde_json::to_string(&all_passports).expect("convert passports to string array"))))
}
