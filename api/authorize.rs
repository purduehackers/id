use std::{collections::HashMap, str::FromStr};

use id::{client_registry, APIError};
use oxide_auth::{
    endpoint::{OwnerConsent, Scope},
    frontends::simple::endpoint::FnSolicitor,
    primitives::{authorizer::AuthMap, generator::RandomGenerator, registrar::Client},
};
use serde_json::json;
use vercel_runtime::{http::bad_request, run, Body, Error, Request, Response, StatusCode};

#[tokio::main]
async fn main() -> Result<(), Error> {
    run(handler).await
}

pub async fn handler(req: Request) -> Result<Response<Body>, Error> {
    match req.body() {
        Body::Empty | Body::Binary(_) => bad_request(APIError {
            message: "Send a valid request pls",
            code: "400",
        }),
        Body::Text(t) => {
            let uri = match url::Url::parse(&req.uri().to_string()) {
                Ok(uri) => uri,
                Err(e) => {
                    todo!()
                }
            };

            let mut query = HashMap::new();

            for (k, v) in uri.query_pairs() {
                query.insert(k.to_string(), v.to_string());
            }

            let auth_header = req
                .headers()
                .into_iter()
                .find(|h| h.0 == "Authorization")
                .map(|h| h.1);

            let form_data = form_urlencoded::parse(t.as_bytes())
                .into_iter()
                .map(|(k, v)| (k.to_string(), v.to_string()))
                .collect::<HashMap<_, _>>();

            let oauth_request = oxide_auth::frontends::simple::request::Request {
                query,
                urlbody: form_data,
                auth: auth_header.map(|ah| ah.to_str().expect("string to be valid").to_string()),
            };

            let mut oauth = oxide_auth::frontends::simple::endpoint::authorization_flow(
                &client_registry(),
                &mut AuthMap::new(RandomGenerator::new(16)),
                &mut FnSolicitor(|_req, _| OwnerConsent::Authorized("TESTING_AUTH_OK".to_string())),
            );

            todo!()
        }
    }
    // let request_body: &Body = req.body();

    // Ok(Response::builder()
    //     .status(StatusCode::OK)
    //     .header("Content-Type", "application/json")
    //     .body(
    //         json!({
    //           "message": "你好，世界"
    //         })
    //         .to_string()
    //         .into(),
    //     )?)
}
