use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[derive(DeriveIden)]
enum AuthSession {
    Table,
    Id,
    OwnerId,
    Token,
    Until,
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
                    .table(AuthSession::Table)
                    .col(
                        ColumnDef::new(AuthSession::Id)
                            .integer()
                            .not_null()
                            .auto_increment()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(AuthSession::Token).string().not_null())
                    .col(
                        ColumnDef::new(AuthSession::Until)
                            .timestamp_with_time_zone()
                            .not_null(),
                    )
                    .col(ColumnDef::new(AuthSession::OwnerId).integer().not_null())
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_auth_session_owner")
                            .to(User::Table, User::Id)
                            .from(AuthSession::Table, AuthSession::OwnerId)
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
            .drop_table(Table::drop().table(AuthSession::Table).to_owned())
            .await
    }
}
