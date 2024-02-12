use id::{wrap_error, OAuthEndpoint, RequestCompat, ResponseCompat};
use oxide_auth::endpoint::{OwnerConsent, Solicitation};
use oxide_auth_async::endpoint::access_token::AccessTokenFlow;
use oxide_auth_async::endpoint::OwnerSolicitor;
use vercel_runtime::{run, Body, Error, Request, Response};

#[tokio::main]
async fn main() -> Result<(), Error> {
    run(wrap_error!(handler)).await
}

struct TokenSolicitor;

#[async_trait::async_trait]
impl OwnerSolicitor<RequestCompat> for TokenSolicitor {
    async fn check_consent(
        &mut self,
        req: &mut RequestCompat,
        _solicitation: Solicitation<'_>,
    ) -> OwnerConsent<ResponseCompat> {
        todo!()
    }
}

pub async fn handler(req: Request) -> Result<Response<Body>, Error> {
    Ok(AccessTokenFlow::prepare(OAuthEndpoint::new(TokenSolicitor))
        .map_err(|e| format!("Access token flow prep error: {e}"))?
        .execute(RequestCompat(req))
        .await
        .map_err(|e| format!("Access token flow exec error: {e}"))?
        .0)
}
