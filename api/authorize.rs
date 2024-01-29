use std::{borrow::Cow, str::FromStr};

use id::{client_registry, APIError, generic_endpoint, RequestCompat, ResponseCompat};
use oxide_auth::{
    endpoint::{WebResponse, Solicitation, OwnerConsent},
    primitives::registrar::{ClientUrl, ExactUrl}, frontends::{simple::endpoint::FnSolicitor, self},
};

use lambda_http::http::Method;
use vercel_runtime::{
    http::{bad_request, internal_server_error},
    run, Body, Error, Request, Response, StatusCode,
};

#[tokio::main]
async fn main() -> Result<(), Error> {
    run(handler).await
}

pub async fn handler(req: Request) -> Result<Response<Body>, Error> {
    if req.method().to_string() == Method::GET.to_string() {
        return handle_get(req).await;
    }

    match req.body() {
        Body::Empty | Body::Binary(_) => bad_request(APIError {
            message: "Send a valid request pls",
            code: "400",
        }),
        Body::Text(_t) => {
            // let mut query = HashMap::new();
            //
            // for (k, v) in uri.query_pairs() {
            //     query.insert(k.to_string(), v.to_string());
            // }
            //
            // let auth_header = req
            //     .headers()
            //     .into_iter()
            //     .find(|h| h.0 == "Authorization")
            //     .map(|h| h.1);
            //
            // let form_data = form_urlencoded::parse(t.as_bytes())
            //     .into_iter()
            //     .map(|(k, v)| (k.to_string(), v.to_string()))
            //     .collect::<HashMap<_, _>>();
            //
            // let oauth_request = oxide_auth::frontends::simple::request::Request {
            //     query,
            //     urlbody: form_data,
            //     auth: auth_header.map(|ah| ah.to_str().expect("string to be valid").to_string()),
            // };

            // let mut oauth = oxide_auth::frontends::simple::endpoint::authorization_flow(
            //     &client_registry(),
            //     &mut AuthMap::new(RandomGenerator::new(16)),
            //     &mut FnSolicitor(|_req, _| OwnerConsent::Authorized("TESTING_AUTH_OK".to_string())),
            // );

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

async fn handle_get(req: Request) -> Result<Response<Body>, Error> {
    // // Make sure the client ID and request URI are valid
    // let uri = match url::Url::parse(&req.uri().to_string()) {
    //     Ok(uri) => uri,
    //     Err(e) => {
    //         return internal_server_error(APIError {
    //             message: &format!("Failed to parse URI: {e}"),
    //             code: "500",
    //         });
    //     }
    // };
    //
    // let client_id = match uri
    //     .query_pairs()
    //     .into_iter()
    //     .find(|(k, _)| *k == Cow::Borrowed("client_id"))
    // {
    //     Some(cid) => cid.1,
    //     None => {
    //         return bad_request(APIError {
    //             message: "No client_id provided!",
    //             code: "400",
    //         })
    //     }
    // };
    //
    // let redirect_uri = match uri
    //     .query_pairs()
    //     .into_iter()
    //     .find(|(k, _)| *k == Cow::Borrowed("redirect_uri"))
    // {
    //     Some(uri) => uri.1,
    //     None => {
    //         return bad_request(APIError {
    //             message: "No redirect_uri provided!",
    //             code: "400",
    //         })
    //     }
    // };

    let res = generic_endpoint(FnSolicitor(move |_: &mut RequestCompat, pre_grant: Solicitation| {
        let mut resp = ResponseCompat::default();
        let pg = pre_grant.pre_grant();
        let url = frontends::dev::Url::parse_with_params("https://id.purduehackers.com/authorize", &[
            ("client_id", &pg.client_id),
            ("redirect_uri", &pg.redirect_uri.to_string()),
            ("scope", &pg.scope.to_string()),
        ]).expect("const URL to be valid");
        resp.redirect(url).expect("infallible");
        OwnerConsent::InProgress(resp)
    })).authorization_flow().execute(RequestCompat(req)).map_err(|e| format!("Error on auth flow: {:?}", e))?;

    // // Figure out what the registry says
    // let registry = client_registry();
    // let bound = registry
    //     .bound_redirect(ClientUrl {
    //         client_id,
    //         redirect_uri: Some(Cow::Owned(ExactUrl::from_str(&redirect_uri)?)),
    //     })
    //     .map_err(|e| format!("Bound redirection error: {:?}", e))?;
    //
    // let pre_grant = registry
    //     .negotiate(bound, None)
    //     .map_err(|e| format!("Negotiation error: {:?}", e))?;
    //
    // // Redirect the user to a page with the necessary info
    // Ok(Response::builder()
    //     .status(StatusCode::SEE_OTHER.as_u16())
    //     .header(
    //         "Location",
    //         &format!(
    //             "/authorize?client_id={}&redirect_uri={}&scope={}",
    //             urlencoding::encode(&pre_grant.client_id),
    //             urlencoding::encode(&pre_grant.redirect_uri.to_string()),
    //             urlencoding::encode(&pre_grant.scope.to_string())
    //         ),
    //     )
    //     .body(Body::Empty)
    //     .expect("response to be built without errors"))
    Ok(res.0)
}
