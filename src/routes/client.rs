use crate::{oauth::VALID_CLIENTS, routes::RouteError};

pub async fn handler() -> Result<Vec<String>, RouteError> {
    Ok(VALID_CLIENTS
        .iter()
        .map(|s| s.client_id.to_string())
        .collect())
}
