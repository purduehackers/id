use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[derive(DeriveIden)]
enum OauthClient {
    Table,
    Id,
    ClientId,
    ClientSecret,
    OwnerId,
    RedirectUri,
    DefaultScope,
    Name,
    CreatedAt,
}

#[derive(DeriveIden)]
enum User {
    Table,
    Id,
}

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(OauthClient::Table)
                    .col(
                        ColumnDef::new(OauthClient::Id)
                            .integer()
                            .not_null()
                            .auto_increment()
                            .primary_key(),
                    )
                    .col(
                        ColumnDef::new(OauthClient::ClientId)
                            .string()
                            .not_null()
                            .unique_key(),
                    )
                    .col(ColumnDef::new(OauthClient::ClientSecret).string().null())
                    .col(ColumnDef::new(OauthClient::OwnerId).integer().not_null())
                    .col(ColumnDef::new(OauthClient::RedirectUri).string().not_null())
                    .col(
                        ColumnDef::new(OauthClient::DefaultScope)
                            .string()
                            .not_null(),
                    )
                    .col(ColumnDef::new(OauthClient::Name).string().not_null())
                    .col(
                        ColumnDef::new(OauthClient::CreatedAt)
                            .timestamp_with_time_zone()
                            .not_null(),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_oauth_client_owner")
                            .to(User::Table, User::Id)
                            .from(OauthClient::Table, OauthClient::OwnerId)
                            .on_delete(ForeignKeyAction::Cascade)
                            .on_update(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(OauthClient::Table).to_owned())
            .await?;

        Ok(())
    }
}
