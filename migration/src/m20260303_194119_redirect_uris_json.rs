use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[derive(DeriveIden)]
enum OauthClient {
    Table,
    RedirectUri,
    RedirectUris,
}

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // Add new JSON column for multiple redirect URIs
        manager
            .alter_table(
                Table::alter()
                    .table(OauthClient::Table)
                    .add_column(ColumnDef::new(OauthClient::RedirectUris).json().null())
                    .to_owned(),
            )
            .await?;

        // Migrate existing data: wrap each redirect_uri string in a JSON array
        let db = manager.get_connection();
        db.execute_unprepared(
            "UPDATE oauth_client SET redirect_uris = json_build_array(redirect_uri)",
        )
        .await?;

        // Make the new column NOT NULL now that data is migrated
        manager
            .alter_table(
                Table::alter()
                    .table(OauthClient::Table)
                    .modify_column(ColumnDef::new(OauthClient::RedirectUris).json().not_null())
                    .to_owned(),
            )
            .await?;

        // Drop the old column
        manager
            .alter_table(
                Table::alter()
                    .table(OauthClient::Table)
                    .drop_column(OauthClient::RedirectUri)
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // Add back the old string column
        manager
            .alter_table(
                Table::alter()
                    .table(OauthClient::Table)
                    .add_column(ColumnDef::new(OauthClient::RedirectUri).string().null())
                    .to_owned(),
            )
            .await?;

        // Migrate data back: take the first element of the JSON array
        let db = manager.get_connection();
        db.execute_unprepared(
            "UPDATE oauth_client SET redirect_uri = redirect_uris->>0",
        )
        .await?;

        // Make NOT NULL
        manager
            .alter_table(
                Table::alter()
                    .table(OauthClient::Table)
                    .modify_column(ColumnDef::new(OauthClient::RedirectUri).string().not_null())
                    .to_owned(),
            )
            .await?;

        // Drop the new column
        manager
            .alter_table(
                Table::alter()
                    .table(OauthClient::Table)
                    .drop_column(OauthClient::RedirectUris)
                    .to_owned(),
            )
            .await?;

        Ok(())
    }
}
