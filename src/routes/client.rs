use crate::{oauth::VALID_CLIENTS, routes::RouteError};

pub async fn handler() -> Result<Vec<String>, RouteError> {
    Ok(VALID_CLIENTS.iter().map(|s| s.to_string()).collect())
}
