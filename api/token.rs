use base64::prelude::{Engine as _, BASE64_STANDARD};
use id::{wrap_error, OAuthEndpoint, RequestCompat, ResponseCompat, VALID_CLIENTS};
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
        // This will do for now for authentication
        // Yes, this is not secure and is very easy to cause problems with,
        // but for right now PH are the only people using this, so we don't
        // need fine-grained control over this stuff
        //
        // Check if the Authorization header matches the format: client_id:SECRET
        // where SECRET is a global constant
        let auth =
            match req
                .headers()
                .iter()
                .find_map(|(k, v)| if *k == "Authorization" { Some(v) } else { None })
            {
                Some(h) => h,
                None => return OwnerConsent::Error("No Authorization header!".into()),
            };

        let auth = BASE64_STANDARD
            .decode(auth.to_str().expect("Valid auth string"))
            .expect("Valid Base64 encoding for Auth header");
        let auth = String::from_utf8(auth).expect("Valid b64 decoded string");
        let mut auth = auth.split(':');
        let client_id = auth.next().expect("Auth header client_id");
        let secret = auth.next().expect("Auth header secret");

        if !VALID_CLIENTS.iter().any(|c| *c == client_id)
            || secret
                != std::env::var("PH_OAUTH_TOKEN_FLOW_SECRET").expect("OAuth token flow secret")
        {
            return OwnerConsent::Denied;
        }

        // TODO: Figure out what needs to go here?
        OwnerConsent::Authorized(client_id.to_string())
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
