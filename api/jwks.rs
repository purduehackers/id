use id::get_jwk;
use id::wrap_error;
use jsonwebkey::JsonWebKey;
use vercel_runtime::{run, Body, Error, Request, Response};

#[tokio::main]
async fn main() -> Result<(), Error> {
    run(wrap_error!(handler)).await
}

pub async fn handler(_req: Request) -> Result<Response<Body>, Error> {
    let key = match get_jwk().key.to_public().expect("public key") {
        std::borrow::Cow::Owned(o) => o,
        std::borrow::Cow::Borrowed(_) => unreachable!(),
    };
    Ok(Response::new(Body::Text(format!(
        "{}",
        JsonWebKey::new(key)
    ))))
}
