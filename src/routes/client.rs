use crate::{oauth::VALID_CLIENTS, routes::RouteError};
use entity::prelude::OAuthClient;
use sea_orm::{DatabaseConnection, EntityTrait};

pub async fn handler(db: &DatabaseConnection) -> Result<Vec<String>, RouteError> {
    // Get static clients
    let mut clients: Vec<String> = VALID_CLIENTS
        .iter()
        .map(|s| s.client_id.to_string())
        .collect();

    // Add database clients
    let db_clients = OAuthClient::find()
        .all(db)
        .await?;

    for client in db_clients {
        if !clients.contains(&client.client_id) {
            clients.push(client.client_id);
        }
    }

    Ok(clients)
}
