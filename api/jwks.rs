use id::get_jwk;
use id::wrap_error;
use vercel_runtime::{run, Body, Error, Request, Response};

#[tokio::main]
async fn main() -> Result<(), Error> {
    run(wrap_error!(handler)).await
}

pub async fn handler(_req: Request) -> Result<Response<Body>, Error> {
    Ok(Response::new(Body::Text(
        get_jwk().key.to_public().unwrap().to_pem(),
    )))
}
