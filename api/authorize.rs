use std::str::FromStr;

use chrono::{Months, Utc};
use entity::{auth_grant, auth_session, passport, sea_orm_active_enums::RoleEnum, user};
use id::{db, kv, tfa, wrap_error, OAuthEndpoint, RequestCompat, ResponseCompat};

use oxide_auth::{
    endpoint::{OwnerConsent, Solicitation, WebResponse},
    frontends::{self, simple::endpoint::FnSolicitor},
};
use oxide_auth_async::endpoint::authorization::AuthorizationFlow;

use entity::prelude::*;
use fred::prelude::*;
use lambda_http::http::{
    header::{COOKIE, LOCATION, SET_COOKIE},
    Method,
};
use oxide_auth_async::endpoint::OwnerSolicitor;

use rand::distributions::{Alphanumeric, DistString};
use sea_orm::{prelude::*, ActiveValue};

use url::Url;
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
        // If there is a session token, try to use that.
        let session = 's: {
            let cookies = req.headers().get_all(COOKIE);
            for cookie in cookies {
                for itm in cookie.to_str().unwrap_or_default().split("; ") {
                    if itm.starts_with("session") {
                        let mut s = itm.split("=");
                        if let Some(v) = s.nth(1) {
                            break 's Some(v);
                        }
                    }
                }
            }

            None
        };

        let url = url::Url::from_str(&req.uri().to_string()).expect("URL to be valid");

        let user_wants_allow = url
            .query_pairs()
            .find_map(|(k, v)| if k == "allow" { Some(v) } else { None })
            .expect("allow param required")
            .parse::<bool>()
            .expect("failed to parse allow");

        let db = db().await.expect("db to be accessible");

        if let Some(token) = session {
            // Validate the token
            let session = AuthSession::find()
                .filter(auth_session::Column::Token.eq(token))
                .one(&db)
                .await
                .unwrap();
            if let Some(session) = session {
                return if user_wants_allow {
                    OwnerConsent::Authorized(session.owner_id.to_string())
                } else {
                    OwnerConsent::Denied
                };
            }
        }

        let passport_id: i32 = url
            .query_pairs()
            .into_iter()
            .find_map(|(k, v)| if k == "id" { Some(v) } else { None })
            .expect("Passport ID to be given")
            .parse()
            .expect("ID to be valid integer");

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
        if solicitation
            .pre_grant()
            .scope
            .iter()
            .any(|s| s.starts_with("admin"))
            && user.role != RoleEnum::Admin
        {
            return OwnerConsent::Error(
                "You may not access administrator scopes!"
                    .to_string()
                    .into(),
            );
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

        if !user_wants_allow {
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

    let mut res = AuthorizationFlow::prepare(OAuthEndpoint::new(
        AuthorizeSolicitor,
        vec!["user".parse().expect("scope to parse")],
    ))
    .map_err(|e| format!("Auth prep error: {e}"))?
    .execute(RequestCompat(req))
    .await
    .map_err(|e| format!("Auth exec error: {e}"))?
    .0;

    // Grant may have been given, see if it was
    if let Some(loc) = res.headers().get(LOCATION) {
        let url = Url::parse(loc.to_str().unwrap()).unwrap();
        if let Some((_, grant)) = url.query_pairs().find(|(k, _)| k == "grant") {
            // Grant given, reverse reference to user and create a session token
            let db = db().await.unwrap();

            let grant: auth_grant::Model = AuthGrant::find()
                .filter(auth_grant::Column::Code.eq(grant.as_ref()))
                .one(&db)
                .await
                .unwrap()
                .expect("grant to exist");

            let new = auth_session::ActiveModel {
                id: ActiveValue::NotSet,
                token: ActiveValue::Set(Alphanumeric.sample_string(&mut rand::thread_rng(), 16)),
                until: ActiveValue::Set((Utc::now() + Months::new(2)).into()),
                owner_id: ActiveValue::Set(grant.owner_id),
            };

            let model = new.insert(&db).await.expect("insert token");

            res.headers_mut().insert(
                SET_COOKIE,
                format!("session={}; Max-Age=5259492; Secure; HttpOnly", model.token)
                    .parse()
                    .unwrap(),
            );

            // Purge invalid cookies
            AuthSession::delete_many()
                .filter(auth_session::Column::Until.lt(Utc::now()))
                .exec(&db)
                .await
                .unwrap();
        }
    }

    Ok(res)
}

async fn handle_get(req: Request) -> Result<Response<Body>, Error> {
    let res = AuthorizationFlow::prepare(OAuthEndpoint::new(
        FnSolicitor(move |req: &mut RequestCompat, pre_grant: Solicitation| {
            let has_session = req
                .headers()
                .get_all("Cookie")
                .iter()
                .any(|v| v.to_str().unwrap_or_default().starts_with("session:"));

            let mut resp = ResponseCompat::default();
            let pg = pre_grant.pre_grant();
            let client_id = pg.client_id.to_string();
            let redirect_uri = pg.redirect_uri.to_string();
            let scope = pg.scope.to_string();
            let mut params = vec![
                ("client_id", client_id.as_str()),
                ("redirect_uri", redirect_uri.as_str()),
                ("scope", scope.as_str()),
                ("response_type", "code"),
            ];

            if has_session {
                params.push(("session", "true"));
            }

            let url = frontends::dev::Url::parse_with_params(
                "https://id.purduehackers.com/authorize",
                &params,
            )
            .expect("const URL to be valid");
            resp.redirect(url).expect("infallible");
            OwnerConsent::InProgress(resp)
        }),
        vec!["user:read".parse().expect("scope to parse")],
    ))
    .map_err(|e| format!("Auth prep error: {e}"))?
    .execute(RequestCompat(req))
    .await
    .map_err(|e| format!("Error on auth flow: {:?}", e))?;

    Ok(res.0)
}
