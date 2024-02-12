use std::str::FromStr;

use entity::{auth_grant, auth_token, passport};
use id::{
    client_registry, db, generic_endpoint, kv, wrap_error, DbAuthorizer, DbIssuer, OAuthEndpoint,
    RequestCompat, ResponseCompat,
};
use oxide_auth::primitives::scope::Scope;
use oxide_auth::{
    endpoint::{OwnerConsent, ResponseStatus, Solicitation, WebRequest, WebResponse},
    frontends::{self, simple::endpoint::FnSolicitor},
    primitives::{generator::RandomGenerator, issuer::TokenMap, registrar::ClientMap},
};
use oxide_auth_async::endpoint::authorization::AuthorizationFlow;

use chrono::{Months, Utc};
use entity::prelude::*;
use fred::prelude::*;
use lambda_http::http::Method;
use oxide_auth_async::{endpoint::Endpoint, endpoint::OwnerSolicitor};
use rand::distributions::{Alphanumeric, DistString};
use sea_orm::{prelude::*, ActiveValue};
use sea_orm::{Condition, IntoActiveModel};

use vercel_runtime::{run, Body, Error, Request, Response};

#[tokio::main]
async fn main() -> Result<(), Error> {
    run(wrap_error!(handler)).await
}

struct AuthorizeSolicitor;

#[async_trait::async_trait]
impl OwnerSolicitor<RequestCompat> for AuthorizeSolicitor {
    async fn check_consent(
        &mut self,
        req: &mut RequestCompat,
        _solicitation: Solicitation<'_>,
    ) -> OwnerConsent<ResponseCompat> {
        let url = url::Url::from_str(&req.uri().to_string()).expect("URL to be valid");

        let passport_id: i32 = url
            .query_pairs()
            .into_iter()
            .find_map(|(k, v)| if k == "id" { Some(v) } else { None })
            .expect("Passport ID to be given")
            .parse()
            .expect("ID to be valid integer");

        let db = db().await.expect("db to be accessible");

        let passport: Option<passport::Model> = Passport::find_by_id(passport_id)
            .one(&db)
            .await
            .expect("db op to succeed");

        let passport = match passport {
            Some(p) => p,
            None => return OwnerConsent::Error("passport doesn't exist!".to_string().into()),
        };

        if !passport.activated {
            return OwnerConsent::Error("passport isn't activated!".to_string().into());
        }

        // If it exists, now try to find in the Redis KV
        let kv = kv().await.expect("redis client to be valid");
        if kv
            .exists::<u32, i32>(passport_id)
            .await
            .expect("redis op to succeed")
            == 0
        {
            return OwnerConsent::Error("Passport has not been scanned!".to_string().into());
        }

        let ready: bool = kv
            .getdel(passport_id)
            .await
            .expect("redis getdel op to succeed");

        if !ready {
            return OwnerConsent::Error("Passport not ready for auth!".to_string().into());
        }

        if !url
            .query_pairs()
            .find_map(|(k, v)| if k == "allow" { Some(v) } else { None })
            .expect("allow param required")
            .parse::<bool>()
            .expect("failed to parse allow")
        {
            OwnerConsent::Denied
        } else {
            OwnerConsent::Authorized(passport.owner_id.to_string())
        }
    }
}

pub async fn handler(req: Request) -> Result<Response<Body>, Error> {
    if req.method() == Method::GET {
        return handle_get(req).await;
    }

    Ok(
        AuthorizationFlow::prepare(OAuthEndpoint::new(AuthorizeSolicitor))
            .map_err(|e| format!("Auth prep error: {e}"))?
            .execute(RequestCompat(req))
            .await
            .map_err(|e| format!("Auth exec error: {e}"))?
            .0,
    )
}

async fn handle_get(req: Request) -> Result<Response<Body>, Error> {
    let res = generic_endpoint(FnSolicitor(
        move |_: &mut RequestCompat, pre_grant: Solicitation| {
            let mut resp = ResponseCompat::default();
            let pg = pre_grant.pre_grant();
            let url = frontends::dev::Url::parse_with_params(
                "https://id.purduehackers.com/authorize",
                &[
                    ("client_id", &pg.client_id),
                    ("redirect_uri", &pg.redirect_uri.to_string()),
                    ("scope", &pg.scope.to_string()),
                    ("response_type", &"code".to_string()),
                ],
            )
            .expect("const URL to be valid");
            resp.redirect(url).expect("infallible");
            OwnerConsent::InProgress(resp)
        },
    ))
    .authorization_flow()
    .execute(RequestCompat(req))
    .map_err(|e| format!("Error on auth flow: {:?}", e))?;

    Ok(res.0)
}
