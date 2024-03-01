use std::str::FromStr;

use entity::{passport, sea_orm_active_enums::RoleEnum, user};
use id::{db, kv, tfa, wrap_error, OAuthEndpoint, RequestCompat, ResponseCompat};

use oxide_auth::{
    endpoint::{OwnerConsent, Solicitation, WebResponse},
    frontends::{self, simple::endpoint::FnSolicitor},
};
use oxide_auth_async::endpoint::authorization::AuthorizationFlow;

use entity::prelude::*;
use fred::prelude::*;
use lambda_http::http::Method;
use oxide_auth_async::endpoint::OwnerSolicitor;

use sea_orm::prelude::*;

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
        solicitation: Solicitation<'_>,
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

        // If the user is an admin or has a 2FA code attached, require it here
        let user: user::Model = passport
            .find_related(User)
            .one(&db)
            .await
            .expect("db op to succeed")
            .expect("Passport to have an owner");

        // Very basic scope control
        if solicitation.pre_grant().scope.iter().any(|s| s.starts_with("admin")) && user.role != RoleEnum::Admin {
            return OwnerConsent::Error("You may not access administrator scopes!".to_string().into());
        }

        if let Some(totp) = user.totp {
            let code = url
                .query_pairs()
                .into_iter()
                .find_map(|(k, v)| if k == "code" { Some(v) } else { None })
                .expect("TOTP code to be given");

            if !tfa::validate_totp(user.id, totp, &code).expect("TOTP validation to succeed") {
                return OwnerConsent::Error("Invalid TOTP code!".to_string().into());
            }
        } else if user.role == RoleEnum::Admin {
            return OwnerConsent::Error("Admin login attempted without TOTP!".to_string().into());
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
        AuthorizationFlow::prepare(OAuthEndpoint::new(AuthorizeSolicitor, vec!["user".parse().expect("scope to parse")]))
            .map_err(|e| format!("Auth prep error: {e}"))?
            .execute(RequestCompat(req))
            .await
            .map_err(|e| format!("Auth exec error: {e}"))?
            .0,
    )
}

async fn handle_get(req: Request) -> Result<Response<Body>, Error> {
    let res = AuthorizationFlow::prepare(OAuthEndpoint::new(FnSolicitor(
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
    ), vec!["user:read".parse().expect("scope to parse")]))
    .map_err(|e| format!("Auth prep error: {e}"))?
    .execute(RequestCompat(req))
    .await
    .map_err(|e| format!("Error on auth flow: {:?}", e))?;

    Ok(res.0)
}
