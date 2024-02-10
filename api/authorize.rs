use std::{str::FromStr, thread};

use entity::{passport, auth_grant};
use id::{client_registry, db, generic_endpoint, kv, wrap_error, RequestCompat, ResponseCompat};
use oxide_auth::primitives::scope::Scope;
use oxide_auth::{
    endpoint::{OwnerConsent, ResponseStatus, Solicitation, WebRequest, WebResponse},
    frontends::{self, simple::endpoint::FnSolicitor},
    primitives::{
        authorizer::AuthMap, generator::RandomGenerator, issuer::TokenMap, registrar::ClientMap,
    },
};
use oxide_auth_async::endpoint::authorization::AuthorizationFlow;
use oxide_auth_async::primitives::Authorizer;
use oxide_auth_async::{
    code_grant::authorization::authorization_code,
    endpoint::{Endpoint, OwnerSolicitor},
};

use rand::distributions::{Alphanumeric, DistString};
use entity::prelude::*;
use fred::prelude::*;
use lambda_http::{http::Method, RequestExt};
use sea_orm::{prelude::*, ActiveValue};
use tokio::runtime::Handle;
use vercel_runtime::{run, Body, Error, Request, Response};

#[tokio::main]
async fn main() -> Result<(), Error> {
    run(wrap_error!(handler)).await
}

struct DbAuthorizer;

#[async_trait::async_trait]
impl Authorizer for DbAuthorizer {
    async fn authorize(&mut self, grant: oxide_auth::primitives::grant::Grant) -> Result<String, ()> {
        let db = db().await.expect("db to be accessible");

        let model = auth_grant::ActiveModel {
            id: ActiveValue::NotSet,
            owner_id: ActiveValue::Set(grant.owner_id.parse().expect("failed to parse owner_id as int")),
            client_id: ActiveValue::Set(grant.client_id),
            redirect_uri: ActiveValue::Set(serde_json::to_value(grant.redirect_uri).expect("url value error")),
            until: ActiveValue::Set(grant.until.naive_utc()),
            scope: ActiveValue::Set(serde_json::to_value(grant.scope).expect("scope to be serializable")),
            code: ActiveValue::Set(Alphanumeric.sample_string(&mut rand::thread_rng(), 32)),
        };

        let grant = model.insert(&db).await.expect("insert to work");
        Ok(grant.code)
    }

    async fn extract(&mut self, token: &str) -> Result<Option<oxide_auth::primitives::grant::Grant>, ()> {
        let db = db().await.expect("db to be accessible");

        let grant: Option<auth_grant::Model> = AuthGrant::find()
            .filter(auth_grant::Column::Code.eq(token.to_string()))
            .one(&db)
            .await
            .expect("db op to not fail");

        Ok(grant.map(|g| oxide_auth::primitives::grant::Grant {
            client_id: g.client_id,
            extensions: Default::default(),
            owner_id: g.owner_id.to_string(),
            scope: serde_json::from_value(g.scope).expect("scope to be deserializable"),
            redirect_uri: serde_json::from_value(g.redirect_uri).expect("redirect uri to be deserializable"),
            until: g.until,
        }))
    }
}

struct AuthorizeEndpoint {
    solicitor: PostSolicitor,
    scopes: Vec<Scope>,
    registry: ClientMap,
    issuer: TokenMap,
    authorizer: AuthMap,
}

impl Default for AuthorizeEndpoint {
    fn default() -> Self {
        Self {
            solicitor: PostSolicitor,
            scopes: vec!["read".parse().expect("unable to parse scope")],
            registry: client_registry(),
            issuer: TokenMap::new(Box::new(RandomGenerator::new(16))),
            authorizer: AuthMap::new(Box::new(RandomGenerator::new(16))),
        }
    }
}

#[async_trait::async_trait]
impl Endpoint<RequestCompat> for AuthorizeEndpoint {
    type Error = Error;

    fn web_error(&mut self, err: <RequestCompat as WebRequest>::Error) -> Self::Error {
        format!("OAuth Web Error: {err}").into()
    }

    fn error(&mut self, err: frontends::dev::OAuthError) -> Self::Error {
        format!("OAuth Error: {err}").into()
    }

    fn owner_solicitor(&mut self) -> Option<&mut (dyn OwnerSolicitor<RequestCompat> + Send)> {
        Some(&mut self.solicitor)
    }

    fn scopes(&mut self) -> Option<&mut dyn oxide_auth::endpoint::Scopes<RequestCompat>> {
        Some(&mut self.scopes)
    }

    fn response(
        &mut self,
        _request: &mut RequestCompat,
        mut kind: oxide_auth::endpoint::Template,
    ) -> Result<<RequestCompat as WebRequest>::Response, Self::Error> {
        if let Some(e) = kind.authorization_error() {
            return Err(format!("Auth error: {e:?}").into());
        }
        // Ok(ResponseCompat(Response::new(Body::Text(kind.authorization_error().map(|e| format!("Auth error: {e:?}")).unwrap_or("Unknown auth error".to_string())))))
        match kind.status() {
            ResponseStatus::Ok | ResponseStatus::Redirect => {
                Ok(ResponseCompat(Response::new(Body::Empty)))
            }
            ResponseStatus::BadRequest => Err("Bad request".to_string().into()),
            ResponseStatus::Unauthorized => Err("Unauthorized".to_string().into()),
        }
    }

    fn registrar(&self) -> Option<&(dyn oxide_auth_async::primitives::Registrar + Sync)> {
        Some(&self.registry)
    }

    // TODO: Replace with db impl
    fn issuer_mut(&mut self) -> Option<&mut (dyn oxide_auth_async::primitives::Issuer + Send)> {
        Some(&mut self.issuer)
    }

    // TODO: Replace with db impl
    fn authorizer_mut(
        &mut self,
    ) -> Option<&mut (dyn oxide_auth_async::primitives::Authorizer + Send)> {
        Some(&mut self.authorizer)
    }
}

struct PostSolicitor;

#[async_trait::async_trait]
impl OwnerSolicitor<RequestCompat> for PostSolicitor {
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

    // let res = generic_endpoint(FnSolicitor(
    //     move |req: &mut RequestCompat, _: Solicitation| {
    //         // TODO: Auth stuff with redis I think???
    //         // Basically need to figure out if user has tapped passport at this time. If they have,
    //         // great! If not (or they denied the login), too bad I guess
    //
    //         let url = url::Url::from_str(&req.uri().to_string()).expect("URL to be valid");
    //
    //
    //         // Is there a passport in the database that matches the number?
    //         // This conversion is gross, but I'm just gonna have to deal with it unless I rewrite
    //         // the library to be async
    //         let res: thread::JoinHandle<Result<(), Error>> = thread::spawn(move || Handle::current().block_on(async move {
    //             let db = db().await?;
    //
    //             let passport: passport::Model = Passport::find_by_id(passport_id)
    //                 .one(&db)
    //                 .await
    //                 .map_err(|e| format!("DB Error: {e}"))?
    //                 .ok_or("No valid passport found".to_string())?;
    //             if !passport.activated {
    //                 return Err("Passport is not activated!".to_string().into());
    //             }
    //
    //
    //             Ok(())
    //         }));
    //
    //         let _ = res.join().expect("DB and KV ops to succeed");
    //
    //         // Login denied
    //         if !url.query_pairs()
    //             .into_iter()
    //             .find_map(|(k,v)| if k == "allow" { Some(v) } else { None })
    //             .expect("allow to be in query")
    //             .parse::<bool>()
    //             .expect("allow to be bool")
    //         {
    //             return OwnerConsent::Denied;
    //         }
    //
    //         OwnerConsent::Authorized("yippee".to_string())
    //     },
    // ))
    // let res = generic_endpoint(PostSolicitor)
    // .authorization_flow()
    // .execute(RequestCompat(req))
    // .map_err(|e| format!("Error on auth flow: {:?}", e))?;
    Ok(AuthorizationFlow::prepare(AuthorizeEndpoint::default())
        .map_err(|e| format!("Auth prep error: {e}"))?
        .execute(RequestCompat(req))
        .await
        .map_err(|e| format!("Auth exec error: {e}"))?
        .0)
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
