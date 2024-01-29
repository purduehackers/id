use id::{generic_endpoint, RequestCompat, ResponseCompat};
use oxide_auth::{
    endpoint::{OwnerConsent, Solicitation, WebRequest, WebResponse},
    frontends::{self, simple::endpoint::FnSolicitor},
};

use lambda_http::http::Method;
use vercel_runtime::{run, Body, Error, Request, Response};

#[tokio::main]
async fn main() -> Result<(), Error> {
    run(handler).await
}

pub async fn handler(req: Request) -> Result<Response<Body>, Error> {
    if req.method().to_string() == Method::GET.to_string() {
        return handle_get(req).await;
    }

    let res = generic_endpoint(FnSolicitor(
        move |req: &mut RequestCompat, _: Solicitation| {
            // TODO: Auth stuff with redis I think???
            // Basically need to figure out if user has tapped passport at this time. If they have,
            // great! If not (or they denied the login), too bad I guess

            // Login denied
            if req
                .query()
                .expect("query to be valid")
                .unique_value("deny")
                .is_some()
            {
                return OwnerConsent::Denied;
            }

            // Is there a passport in the database that matches the number?
            let res = tokio::task::spawn_blocking(|| async move {
                todo!()
            });
            todo!()
        },
    ))
    .authorization_flow()
    .execute(RequestCompat(req))
    .map_err(|e| format!("Error on auth flow: {:?}", e))?;

    Ok(res.0)
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
