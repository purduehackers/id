use std::str::FromStr;

use axum::{
    extract::{OriginalUri, Request, State},
    http::{
        header::{LOCATION, SET_COOKIE},
        HeaderMap, Uri,
    },
    response::IntoResponse,
};
use axum_extra::extract::CookieJar;
use chrono::{Months, Utc};
use entity::{auth_grant, auth_session, passport, sea_orm_active_enums::RoleEnum, user};

use leptos_router::params::ParamsMap;
use oxide_auth::{
    endpoint::{OwnerConsent, Solicitation, WebResponse},
    frontends::{self, simple::endpoint::FnSolicitor},
};
use oxide_auth_async::endpoint::authorization::AuthorizationFlow;

use entity::prelude::*;
use fred::prelude::*;

use oxide_auth_async::endpoint::OwnerSolicitor;

use oxide_auth_axum::{OAuthRequest, OAuthResource, OAuthResponse, WebError};
use rand::distributions::{Alphanumeric, DistString};
use sea_orm::{prelude::*, ActiveValue, Condition};

use url::Url;

use crate::{
    oauth::OAuthEndpoint,
    routes::{scope::AUTH, RouteError, RouteState},
    tfa,
};

struct AuthorizeSolicitor {
    state: RouteState,
    uri: Uri,
    session: Option<String>,
}

#[async_trait::async_trait]
impl OwnerSolicitor<OAuthRequest> for AuthorizeSolicitor {
    async fn check_consent(
        &mut self,
        _req: &mut OAuthRequest,
        solicitation: Solicitation<'_>,
    ) -> OwnerConsent<OAuthResponse> {
        // If there is a session token, try to use that.
        let session = self.session.clone();

        // Doesn't matter what the host is, only the query
        let url = url::Url::from_str(&format!("https://example.com{}", self.uri))
            .expect("URL to be valid");

        let user_wants_allow = url
            .query_pairs()
            .find_map(|(k, v)| if k == "allow" { Some(v) } else { None })
            .expect("allow param required")
            .parse::<bool>()
            .expect("failed to parse allow");

        let db = self.state.db.clone();

        if let Some(token) = session {
            // Validate the token
            let session = AuthSession::find()
                .filter(
                    Condition::all()
                        .add(auth_session::Column::Token.eq(token))
                        .add(auth_session::Column::Until.gte(Utc::now())),
                )
                .one(&db)
                .await
                .expect("db ok");
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
            None => {
                return OwnerConsent::Error(WebError::InternalError(Some(
                    "Passport not found".to_string(),
                )));
            }
        };

        if !passport.activated {
            return OwnerConsent::Error(WebError::InternalError(Some(
                "Passport not activated".to_string(),
            )));
        }

        // If it exists, now try to find in the Redis KV
        let kv = self.state.kv.clone();
        if kv
            .exists::<u32, i32>(passport_id)
            .await
            .expect("redis op to succeed")
            == 0
        {
            return OwnerConsent::Error(WebError::InternalError(Some(
                "Passport has not been scanned!".to_string(),
            )));
        }

        let ready: bool = kv
            .getdel(passport_id)
            .await
            .expect("redis getdel op to succeed");

        if !ready {
            return OwnerConsent::Error(WebError::InternalError(Some(
                "Passport not ready for auth!".to_string(),
            )));
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
            return OwnerConsent::Error(WebError::InternalError(Some(
                "You may not access administrator scopes!".to_string(),
            )));
        }

        if let Some(totp) = user.totp {
            let code = url
                .query_pairs()
                .into_iter()
                .find_map(|(k, v)| if k == "code" { Some(v) } else { None })
                .expect("TOTP code to be given");

            if !tfa::validate_totp(user.id, totp, &code).expect("TOTP validation to succeed") {
                return OwnerConsent::Error(WebError::InternalError(Some(
                    "Invalid TOTP code!".to_string(),
                )));
            }
        } else if user.role == RoleEnum::Admin {
            return OwnerConsent::Error(WebError::InternalError(Some(
                "Admin login attempted without TOTP!".to_string(),
            )));
        }

        if !user_wants_allow {
            OwnerConsent::Denied
        } else {
            OwnerConsent::Authorized(passport.owner_id.to_string())
        }
    }
}

pub async fn handle_post(
    cookies: CookieJar,
    State(state): State<RouteState>,
    uri: OriginalUri,
    oauth: OAuthRequest,
) -> Result<impl IntoResponse, RouteError> {
    let res = AuthorizationFlow::prepare(OAuthEndpoint::new(
        AuthorizeSolicitor {
            state: state.clone(),
            uri: uri.0,
            session: cookies
                .get("session")
                .map(|cookie| cookie.value().to_string()),
        },
        AUTH.names(),
        state.issuer,
        state.authorizer,
    ))?
    .execute(oauth)
    .await?;

    let mut res = res.into_response();

    let db = state.db;

    // Grant may have been given, see if it was
    if let Some(loc) = res.headers().get(LOCATION) {
        let url = Url::parse(loc.to_str().expect("valid loc string")).expect("valid url");
        if let Some((_, grant)) = url.query_pairs().find(|(k, _)| k == "code") {
            // Grant given, reverse reference to user and create a session token

            let grant: auth_grant::Model = AuthGrant::find()
                .filter(auth_grant::Column::Code.eq(grant.as_ref()))
                .one(&db)
                .await
                .expect("db ok")
                .expect("grant to exist");

            let new = auth_session::ActiveModel {
                id: ActiveValue::NotSet,
                token: ActiveValue::Set(Alphanumeric.sample_string(&mut rand::thread_rng(), 32)),
                until: ActiveValue::Set((Utc::now() + Months::new(2)).into()),
                owner_id: ActiveValue::Set(grant.owner_id),
            };

            let model = new.insert(&db).await.expect("insert token");

            res.headers_mut().insert(
                SET_COOKIE,
                format!(
                    "session={}; Max-Age=5259492; Secure; HttpOnly; Path=/",
                    model.token
                )
                .parse()
                .expect("valid cookie parse"),
            );

            // Purge invalid cookies
            AuthSession::delete_many()
                .filter(auth_session::Column::Until.lt(Utc::now()))
                .exec(&db)
                .await
                .expect("db ok");
        }
    }

    Ok(res)
}

pub async fn handle_get(
    cookies: CookieJar,
    State(state): State<RouteState>,
    oauth: OAuthRequest,
) -> Result<impl IntoResponse, RouteError> {
    let res = AuthorizationFlow::prepare(OAuthEndpoint::new(
        FnSolicitor(move |_req: &mut OAuthRequest, pre_grant: Solicitation| {
            let has_session = cookies.get("session").is_some();

            let mut resp = OAuthResponse::default();
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
        AUTH.names(),
        state.issuer,
        state.authorizer,
    ))?
    .execute(oauth)
    .await?;

    Ok(res)
}
