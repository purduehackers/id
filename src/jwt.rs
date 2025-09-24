use std::{env, str::FromStr};

use chrono::{DateTime, Months, Utc};
use jsonwebkey::JsonWebKey;
use jsonwebtoken::{decode, encode, Header, TokenData, Validation};
use oxide_auth::{
    endpoint::Scope,
    primitives::{
        grant::Grant,
        issuer::{IssuedToken, TokenType},
    },
};
use oxide_auth_async::primitives::{Authorizer, Issuer};
use serde::{Deserialize, Serialize};
use url::Url;

use crate::oauth::VALID_CLIENTS;

#[derive(Serialize, Deserialize)]
struct Claims {
    sub: String, // Subject (user ID)

    exp: i64, // Expiration time (timestamp)

    iat: i64, // Issued at (timestamp)

    iss: String, // Issuer

    aud: String, // Audience

    scope: Scope,
}

/// Not currently in use but can be switched to whenever
#[derive(Debug, Clone)]
pub struct JwtAuthorizer;

pub fn get_jwk() -> JsonWebKey {
    let mut k: JsonWebKey = env::var("JWK")
        .expect("JWK to be present")
        .parse()
        .expect("JWK parse");

    k.set_algorithm(jsonwebkey::Algorithm::ES256)
        .expect("valid algorithm");

    k
}

#[derive(Debug, Clone, Copy)]

enum IdIsuser {
    Id,

    IdGrant,
}

fn get_validator(iss: IdIsuser) -> Validation {
    let mut val = Validation::new(get_jwk().algorithm.expect("algo").into());

    val.set_issuer(&[match iss {
        IdIsuser::Id => "id",

        IdIsuser::IdGrant => "id-grant",
    }]);

    val.set_audience(
        &VALID_CLIENTS
            .iter()
            .map(|c| c.client_id)
            .collect::<Vec<_>>(),
    );

    val
}

#[async_trait::async_trait]
impl Authorizer for JwtAuthorizer {
    async fn authorize(
        &mut self,

        grant: oxide_auth::primitives::grant::Grant,
    ) -> Result<String, ()> {
        let claims = Claims {
            sub: grant.owner_id,

            exp: grant.until.timestamp(),

            iat: Utc::now().timestamp(),

            iss: "id-grant".to_string(),

            aud: grant.client_id,

            scope: grant.scope,
        };

        let jwk = get_jwk();

        let token = encode(
            &Header::new(jwk.algorithm.expect("algo present").into()),
            &claims,
            &jwk.key.to_encoding_key(),
        )
        .expect("JWT encode success");

        Ok(token)
    }

    async fn extract(&mut self, token: &str) -> Result<Option<Grant>, ()> {
        let Ok(TokenData { claims, .. }) = decode::<Claims>(
            token,
            &get_jwk().key.to_decoding_key(),
            &get_validator(IdIsuser::IdGrant),
        ) else {
            return Err(());
        };

        let Some(redirect_uri) = VALID_CLIENTS
            .iter()
            .find(|c| c.client_id == claims.aud)
            .map(|c| c.url)
        else {
            return Err(());
        };

        Ok(Some(Grant {
            owner_id: claims.sub,

            client_id: claims.aud,

            scope: claims.scope,

            until: DateTime::from_timestamp(claims.exp, 0).expect("valid timestamp"),

            extensions: Default::default(),

            redirect_uri: Url::from_str(redirect_uri).expect("valid url"),
        }))
    }
}

#[derive(Debug, Clone)]
pub struct JwtIssuer;

#[async_trait::async_trait]
impl Issuer for JwtIssuer {
    async fn issue(
        &mut self,

        grant: oxide_auth::primitives::grant::Grant,
    ) -> Result<oxide_auth::primitives::prelude::IssuedToken, ()> {
        let until = Utc::now() + Months::new(1);

        let claims = Claims {
            sub: grant.owner_id,

            exp: until.timestamp(),

            iat: Utc::now().timestamp(),

            iss: "id".to_string(),

            aud: grant.client_id,

            scope: grant.scope,
        };

        let jwk = get_jwk();

        let token = encode(
            &Header::new(jwk.algorithm.expect("algo present").into()),
            &claims,
            &jwk.key.to_encoding_key(),
        )
        .expect("JWT encode success");

        Ok(IssuedToken {
            token,

            refresh: None,

            token_type: TokenType::Bearer,

            until,
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
        let Ok(TokenData { claims, .. }) = decode::<Claims>(
            t,
            &get_jwk().key.to_decoding_key(),
            &get_validator(IdIsuser::Id),
        ) else {
            return Err(());
        };

        let Some(redirect_uri) = VALID_CLIENTS
            .iter()
            .find(|c| c.client_id == claims.aud)
            .map(|c| c.url)
        else {
            return Err(());
        };

        Ok(Some(Grant {
            owner_id: claims.sub,

            client_id: claims.aud,

            scope: claims.scope,

            until: DateTime::from_timestamp(claims.exp, 0).expect("valid timestamp"),

            extensions: Default::default(),

            redirect_uri: Url::from_str(redirect_uri).expect("valid url"),
        }))
    }

    async fn recover_refresh(
        &mut self,

        _: &str,
    ) -> Result<Option<oxide_auth::primitives::grant::Grant>, ()> {
        // No refresh tokens

        Err(())
    }
}
