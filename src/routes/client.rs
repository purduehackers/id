use crate::VALID_CLIENTS;
use axum::Json;

use crate::routes::RouteError;

#[derive(serde::Serialize)]
pub struct ValidClients {
    valid_clients: Vec<String>,
}

pub async fn handler() -> Result<Json<ValidClients>, RouteError> {
    Ok(Json(ValidClients {
        valid_clients: VALID_CLIENTS.iter().map(|s| s.to_string()).collect(),
    }))
}
