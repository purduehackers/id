use id::{wrap_error, OAuthEndpoint, RequestCompat, oauth_resource};
use lambda_http::http::Method;
use vercel_runtime::{run, Body, Error, Request, Response};

#[tokio::main]
async fn main() -> Result<(), Error> {
    run(wrap_error!(handler)).await
}

pub async fn handler(req: Request) -> Result<Response<Body>, Error> {
    oauth_resource(req, vec!["admin:read".parse().expect("scope to parse")]).await?;

    todo!()
}
