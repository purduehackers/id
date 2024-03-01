use id::{wrap_error, OAuthEndpoint, RequestCompat};
use lambda_http::http::Method;
use oxide_auth::frontends::simple::endpoint::Vacant;
use oxide_auth_async::endpoint::resource::ResourceFlow;
use vercel_runtime::{run, Body, Error, Request, Response};

#[tokio::main]
async fn main() -> Result<(), Error> {
    run(wrap_error!(handler)).await
}

pub async fn handler(req: Request) -> Result<Response<Body>, Error> {
    if req.method() == Method::GET {
        return handle_get(req).await;
    }

    todo!()
}

pub async fn handle_get(req: Request) -> Result<Response<Body>, Error> {
    // Validate scope
    ResourceFlow::prepare(OAuthEndpoint::new(
        Vacant,
        vec!["admin:read".parse().expect("scope to parse")],
    ))
    .map_err(|e| format!("Resource flow prep error: {e:?}"))?
    .execute(RequestCompat(req))
    .await
    .map_err(|e| format!("Resource flow exec error: {e:?}"))?;
    todo!()
}
