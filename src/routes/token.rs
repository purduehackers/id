use axum::extract::State;
use oxide_auth::endpoint::{OwnerConsent, Solicitation};
use oxide_auth_async::endpoint::OwnerSolicitor;
use oxide_auth_async::endpoint::access_token::AccessTokenFlow;
use oxide_auth_axum::{OAuthRequest, OAuthResource, OAuthResponse};

use crate::oauth::OAuthEndpoint;
use crate::routes::scope::USER;
use crate::routes::{RouteError, RouteState};

struct TokenSolicitor;

#[async_trait::async_trait]
impl OwnerSolicitor<OAuthRequest> for TokenSolicitor {
    async fn check_consent(
        &mut self,
        _req: &mut OAuthRequest,
        solicitation: Solicitation<'_>,
    ) -> OwnerConsent<OAuthResponse> {
        // This will do for now for authentication
        // Yes, this is not secure and is very easy to cause problems with,
        // but for right now PH are the only people using this, so we don't
        // need fine-grained control over this stuff
        //
        // Check if the Authorization header matches the format: client_id:SECRET
        // where SECRET is a global constant
        //
        // Realized I don't need to do this right now
        // let auth =
        //     match req
        //         .headers()
        //         .iter()
        //         .find_map(|(k, v)| if *k == "Authorization" { Some(v) } else { None })
        //     {
        //         Some(h) => h,
        //         None => return OwnerConsent::Error("No Authorization header!".into()),
        //     };
        //
        // let auth = BASE64_STANDARD
        //     .decode(auth.to_str().expect("Valid auth string"))
        //     .expect("Valid Base64 encoding for Auth header");
        // let auth = String::from_utf8(auth).expect("Valid b64 decoded string");
        // let mut auth = auth.split(':');
        // let client_id = auth.next().expect("Auth header client_id");
        // let secret = auth.next().expect("Auth header secret");
        //
        // if !VALID_CLIENTS.iter().any(|c| *c == client_id)
        //     || secret
        //         != std::env::var("PH_OAUTH_TOKEN_FLOW_SECRET").expect("OAuth token flow secret")
        // {
        //     return OwnerConsent::Denied;
        // }

        // TODO: Figure out what needs to go here?
        OwnerConsent::Authorized(solicitation.pre_grant().client_id.clone())
    }
}

#[axum::debug_handler]
pub async fn handler(
    req: OAuthResource,
    State(RouteState {
        issuer, authorizer, ..
    }): State<RouteState>,
) -> Result<OAuthResponse, RouteError> {
    AccessTokenFlow::prepare(OAuthEndpoint::new(
        TokenSolicitor,
        USER.names(),
        issuer,
        authorizer,
    ))?
    .execute(req.into())
    .await
}
