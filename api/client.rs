use id::wrap_error;
use id::VALID_CLIENTS;
use vercel_runtime::{run, Body, Error, Request, Response};

#[tokio::main]
async fn main() -> Result<(), Error> {
    run(wrap_error!(handler)).await
}

#[derive(serde::Serialize)]
struct ValidClients<'a> {
    valid_clients: Vec<&'a str>,
}

pub async fn handler(_req: Request) -> Result<Response<Body>, Error> {
    Ok(Response::new(Body::Text(
        serde_json::to_string(&ValidClients {
            valid_clients: VALID_CLIENTS.iter().map(|c| c.client_id).collect(),
        })
        .unwrap(),
    )))
}
