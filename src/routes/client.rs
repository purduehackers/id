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

/// Returns (client_id, display_name) pairs for all clients.
pub async fn client_names(db: &DatabaseConnection) -> Result<Vec<(String, String)>, RouteError> {
    let mut names: Vec<(String, String)> = VALID_CLIENTS
        .iter()
        .map(|s| (s.client_id.to_string(), s.name.to_string()))
        .collect();

    let db_clients = OAuthClient::find().all(db).await?;

    for client in db_clients {
        if !names.iter().any(|(id, _)| *id == client.client_id) {
            names.push((client.client_id, client.name));
        }
    }

    Ok(names)
}
