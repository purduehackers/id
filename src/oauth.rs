use std::str::FromStr;

use chrono::{Months, Utc};
use entity::{
    auth_grant, auth_token,
    prelude::{AuthGrant, AuthToken},
};
use oxide_auth::endpoint::{OAuthError, ResponseStatus, Scope, WebRequest};
use oxide_auth_async::{
    endpoint::{Endpoint, OwnerSolicitor},
    primitives::{Authorizer, Issuer},
};
use oxide_auth_axum::{OAuthRequest, OAuthResponse};
use rand::distributions::{Alphanumeric, DistString};
use sea_orm::{prelude::*, ActiveValue, Condition, DatabaseConnection, IntoActiveModel};

use crate::routes::RouteError;

use oxide_auth::{
    frontends::dev::Url,
    primitives::registrar::{Client, ClientMap, RegisteredUrl},
};

pub const VALID_CLIENTS: [&str; 8] = [
    "dashboard",
    "passports",
    "authority",
    "auth-test",
    "vulcan-auth",
    "shad-moe",
    "shquid",
    "fiestadothorse",
];

pub fn client_registry() -> ClientMap {
    let mut clients = ClientMap::new();
    clients.register_client(Client::public(
        VALID_CLIENTS[0],
        RegisteredUrl::Semantic(
            Url::from_str("https://dash.purduehackers.com/api/callback").expect("url to be valid"),
        ),
        "user:read".parse().expect("scope to be valid"),
    ));

    clients.register_client(Client::public(
        VALID_CLIENTS[1],
        RegisteredUrl::Semantic(
            Url::from_str("https://passports.purduehackers.com/callback").expect("url to be valid"),
        ),
        "user:read user".parse().expect("scopes to be valid"),
    ));

    clients.register_client(Client::public(
        VALID_CLIENTS[2],
        RegisteredUrl::Semantic(Url::from_str("authority://callback").expect("url to be valid")),
        "admin:read admin".parse().expect("scopes to be valid"),
    ));

    clients.register_client(Client::public(
        VALID_CLIENTS[3],
        RegisteredUrl::Semantic(
            Url::from_str("https://id-auth.purduehackers.com/api/auth/callback/purduehackers-id")
                .expect("url to be valid"),
        ),
        "user:read user".parse().expect("scopes to be valid"),
    ));

    clients.register_client(Client::public(
        VALID_CLIENTS[4],
        RegisteredUrl::Semantic(
            Url::from_str("https://auth.purduehackers.com/source/oauth/callback/purduehackers-id/")
                .expect("url to be valid"),
        ),
        "user:read user".parse().expect("scopes to be valid"),
    ));

    clients.register_client(Client::public(
        VALID_CLIENTS[5],
        RegisteredUrl::Semantic(
            Url::from_str("https://auth.shad.moe/source/oauth/callback/purduehackers-id/")
                .expect("url to be valid"),
        ),
        "user:read user".parse().expect("scopes to be valid"),
    ));

    clients.register_client(Client::public(
        VALID_CLIENTS[6],
        RegisteredUrl::Semantic(
            Url::from_str("https://www.imsqu.id/auth/callback/purduehackers-id")
                .expect("url to be valid"),
        ),
        "user:read".parse().expect("scopes to be valid"),
    ));

    clients.register_client(Client::public(
        VALID_CLIENTS[7],
        RegisteredUrl::Semantic(
            Url::from_str("https://fiesta.horse/api/auth/callback/purduehackers-id")
                .expect("url to be valid"),
        ),
        "user:read".parse().expect("scopes to be valid"),
    ));

    clients
}

#[derive(Debug, Clone)]
pub struct DbIssuer {
    db: DatabaseConnection,
}

impl DbIssuer {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }
}

#[async_trait::async_trait]
impl Issuer for DbIssuer {
    async fn issue(
        &mut self,
        grant: oxide_auth::primitives::grant::Grant,
    ) -> Result<oxide_auth::primitives::prelude::IssuedToken, ()> {
        let grant: auth_grant::Model = AuthGrant::find()
            .filter(
                Condition::all()
                    .add(
                        auth_grant::Column::OwnerId.eq(grant
                            .owner_id
                            .parse::<i32>()
                            .expect("failed to parse owner_id as int")),
                    )
                    .add(auth_grant::Column::ClientId.eq(grant.client_id.clone())),
            )
            .one(&self.db)
            .await
            .expect("db op to succeed")
            .expect("grant to be there already");

        let new = auth_token::ActiveModel {
            id: ActiveValue::NotSet,
            grant_id: ActiveValue::Set(grant.id),
            token: ActiveValue::Set(Alphanumeric.sample_string(&mut rand::thread_rng(), 32)),
            until: ActiveValue::Set((Utc::now() + Months::new(1)).into()),
        };

        let new = new.insert(&self.db).await.expect("insert op to succeed");
        Ok(oxide_auth::primitives::issuer::IssuedToken {
            refresh: None,
            token: new.token,
            token_type: oxide_auth::primitives::issuer::TokenType::Bearer,
            until: new.until.into(),
        })
    }

    async fn refresh(
        &mut self,
        _: &str,
        _: oxide_auth::primitives::grant::Grant,
    ) -> Result<oxide_auth::primitives::issuer::RefreshedToken, ()> {
        // No refresh tokens
        Err(())
    }

    async fn recover_token(
        &mut self,
        t: &str,
    ) -> Result<Option<oxide_auth::primitives::grant::Grant>, ()> {
        let token: Option<auth_token::Model> = AuthToken::find()
            .filter(auth_token::Column::Token.eq(t))
            .one(&self.db)
            .await
            .expect("db op to succeed");

        Ok(match token {
            Some(t) => {
                let grant: auth_grant::Model = t
                    .find_related(AuthGrant)
                    .one(&self.db)
                    .await
                    .expect("db op to succeed")
                    .expect("token to have grant parent");

                let scope: String =
                    serde_json::from_value(grant.scope).expect("scope to be valid object");
                let redirect_uri: String = serde_json::from_value(grant.redirect_uri)
                    .expect("redirect_uri to be valid object");

                Some(oxide_auth::primitives::grant::Grant {
                    owner_id: grant.owner_id.to_string(),
                    client_id: grant.client_id,
                    scope: scope.parse().expect("scope parse"),
                    extensions: Default::default(),
                    redirect_uri: redirect_uri.parse().expect("redirect uri parse"),
                    until: t.until.into(),
                })
            }
            None => None,
        })
    }

    async fn recover_refresh(
        &mut self,
        _: &str,
    ) -> Result<Option<oxide_auth::primitives::grant::Grant>, ()> {
        // No refresh tokens
        Err(())
    }
}

#[derive(Debug, Clone)]
pub struct DbAuthorizer {
    db: DatabaseConnection,
}

impl DbAuthorizer {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }
}

#[async_trait::async_trait]
impl Authorizer for DbAuthorizer {
    async fn authorize(
        &mut self,
        grant: oxide_auth::primitives::grant::Grant,
    ) -> Result<String, ()> {
        // WARNING: This code is very stupid, why did I do this
        // let existing: Option<auth_grant::Model> = AuthGrant::find()
        //     .filter(
        //         Condition::all()
        //             .add(
        //                 auth_grant::Column::OwnerId.eq(grant
        //                     .owner_id
        //                     .parse::<i32>()
        //                     .expect("failed to parse owner_id as int")),
        //             )
        //             .add(auth_grant::Column::ClientId.eq(grant.client_id.clone())),
        //     )
        //     .one(&db)
        //     .await
        //     .expect("db op to succeed");
        //
        // if let Some(existing) = existing {
        //     let mut active = existing.into_active_model();
        //     active.until = ActiveValue::Set(grant.until.into());
        //
        //     let active = active.update(&db).await.expect("db update op to succeed");
        //     return Ok(active.code);
        // }

        let model = auth_grant::ActiveModel {
            id: ActiveValue::NotSet,
            owner_id: ActiveValue::Set(
                grant
                    .owner_id
                    .parse()
                    .expect("failed to parse owner_id as int"),
            ),
            client_id: ActiveValue::Set(grant.client_id),
            redirect_uri: ActiveValue::Set(
                serde_json::to_value(grant.redirect_uri).expect("url value error"),
            ),
            until: ActiveValue::Set(grant.until.into()),
            scope: ActiveValue::Set(
                serde_json::to_value(grant.scope).expect("scope to be serializable"),
            ),
            code: ActiveValue::Set(Some(
                Alphanumeric.sample_string(&mut rand::thread_rng(), 32),
            )),
        };

        let grant = model.insert(&self.db).await.expect("insert to work");
        Ok(grant.code.expect("grant code to be valid initially"))
    }

    async fn extract(
        &mut self,
        token: &str,
    ) -> Result<Option<oxide_auth::primitives::grant::Grant>, ()> {
        let grant: Option<auth_grant::Model> = AuthGrant::find()
            .filter(auth_grant::Column::Code.eq(token.to_string()))
            .one(&self.db)
            .await
            .expect("db op to not fail");

        Ok(match grant {
            Some(g) => {
                let mut am = g.clone().into_active_model();
                am.code = ActiveValue::Set(None);
                am.save(&self.db).await.expect("db save to work");

                let scope: String =
                    serde_json::from_value(g.scope).expect("scope to be deserializable");
                let uri: String = serde_json::from_value(g.redirect_uri)
                    .expect("redirect uri to be deserializable");
                Some(oxide_auth::primitives::grant::Grant {
                    client_id: g.client_id,
                    extensions: Default::default(),
                    owner_id: g.owner_id.to_string(),
                    scope: Scope::from_str(&scope).expect("scope deserialization from string"),
                    redirect_uri: Url::from_str(&uri).expect("url deserialization from string"),
                    until: g.until.into(),
                })
            }
            None => None,
        })
    }
}

pub struct OAuthEndpoint<T: OwnerSolicitor<OAuthRequest>> {
    solicitor: T,
    scopes: Vec<Scope>,
    registry: ClientMap,
    issuer: DbIssuer,
    authorizer: DbAuthorizer,
}

#[async_trait::async_trait]
impl<T: OwnerSolicitor<OAuthRequest> + Send> Endpoint<OAuthRequest> for OAuthEndpoint<T> {
    type Error = RouteError;

    fn web_error(&mut self, err: <OAuthRequest as WebRequest>::Error) -> Self::Error {
        err.into()
    }

    fn error(&mut self, err: OAuthError) -> Self::Error {
        err.into()
    }

    fn owner_solicitor(&mut self) -> Option<&mut (dyn OwnerSolicitor<OAuthRequest> + Send)> {
        Some(&mut self.solicitor)
    }

    fn scopes(&mut self) -> Option<&mut dyn oxide_auth::endpoint::Scopes<OAuthRequest>> {
        Some(&mut self.scopes)
    }

    fn response(
        &mut self,
        _request: &mut OAuthRequest,
        mut kind: oxide_auth::endpoint::Template,
    ) -> Result<<OAuthRequest as WebRequest>::Response, Self::Error> {
        if let Some(e) = kind.authorization_error() {
            return Err(RouteError::Auth(e.kind()));
        }
        if let Some(e) = kind.access_token_error() {
            return Err(RouteError::AccessToken(e.kind()));
        }

        match kind.status() {
            ResponseStatus::Ok | ResponseStatus::Redirect => Ok(OAuthResponse::default()),
            ResponseStatus::BadRequest => Err(RouteError::BadRequest),
            ResponseStatus::Unauthorized => Err(RouteError::Unauthorized),
        }
    }

    fn registrar(&self) -> Option<&(dyn oxide_auth_async::primitives::Registrar + Sync)> {
        Some(&self.registry)
    }

    fn issuer_mut(&mut self) -> Option<&mut (dyn oxide_auth_async::primitives::Issuer + Send)> {
        Some(&mut self.issuer)
    }

    fn authorizer_mut(
        &mut self,
    ) -> Option<&mut (dyn oxide_auth_async::primitives::Authorizer + Send)> {
        Some(&mut self.authorizer)
    }
}

impl<T: OwnerSolicitor<OAuthRequest>> OAuthEndpoint<T> {
    pub fn new(
        solicitor: T,
        scopes: Vec<Scope>,
        issuer: DbIssuer,
        authorizer: DbAuthorizer,
    ) -> Self {
        Self {
            solicitor,
            scopes,
            registry: client_registry(),
            issuer,
            authorizer,
        }
    }
}
