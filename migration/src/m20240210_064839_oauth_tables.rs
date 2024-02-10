use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[derive(DeriveIden)]
enum AuthGrant {
    Table,
    Id,
    OwnerId,
    RedirectUri,
    ClientId,
    Scope,
    Until,
    Code,
}

#[derive(DeriveIden)]
enum AuthToken {
    Table,
    Id,
    GrantId,
    Token,
    Until,
}

#[derive(DeriveIden)]
enum User {
    Table,
    Id
}

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager.create_table(
            Table::create()
                .table(AuthGrant::Table)
                .col(
                    ColumnDef::new(AuthGrant::Id)
                        .integer()
                        .not_null()
                        .auto_increment()
                        .primary_key()
                )
                .col(
                    ColumnDef::new(AuthGrant::OwnerId)
                        .integer()
                        .not_null()
                )
                .col(
                    ColumnDef::new(AuthGrant::RedirectUri)
                        .json()
                        .not_null()
                )
                .col(
                    ColumnDef::new(AuthGrant::Until)
                        .timestamp()
                        .not_null()
                )
                .col(
                    ColumnDef::new(AuthGrant::Scope)
                        .json()
                        .not_null()
                )
                .col(
                    ColumnDef::new(AuthGrant::ClientId)
                        .string()
                        .not_null()
                )
                .col(
                    ColumnDef::new(AuthGrant::Code)
                        .string()
                        .not_null()
                )
                .foreign_key(
                    ForeignKey::create()
                        .name("fk_auth_grant_owner")
                        .to(User::Table, User::Id)
                        .from(AuthGrant::Table, AuthGrant::OwnerId)
                        .on_delete(ForeignKeyAction::Cascade)
                        .on_update(ForeignKeyAction::Cascade),
                )
                .to_owned()
        ).await?;

        manager.create_table(
            Table::create()
                .table(AuthToken::Table)
                .col(
                    ColumnDef::new(AuthToken::Id)
                        .integer()
                        .not_null()
                        .auto_increment()
                        .primary_key()
                )
                .col(
                    ColumnDef::new(AuthToken::GrantId)
                        .integer()
                        .not_null()
                )
                .col(
                    ColumnDef::new(AuthToken::Token)
                        .string()
                        .not_null()
                )
                .col(
                    ColumnDef::new(AuthToken::Until)
                        .timestamp()
                        .not_null()
                )
                .foreign_key(
                    ForeignKey::create()
                        .name("fk_auth_token_grant")
                        .to(AuthGrant::Table, AuthGrant::Id)
                        .from(AuthToken::Table, AuthToken::GrantId)
                        .on_delete(ForeignKeyAction::Cascade)
                        .on_update(ForeignKeyAction::Cascade),
                )
                .to_owned()
        ).await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager.drop_table(Table::drop().table(AuthToken::Table).to_owned()).await?;

        manager.drop_table(Table::drop().table(AuthGrant::Table).to_owned()).await?;
        
        Ok(())
    }
}
