use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                TableAlterStatement::new()
                    .table(AuthGrant::Table)
                    .modify_column(
                        ColumnDef::new(AuthGrant::Code)
                            .string()
                            .null()
                    )
                    .to_owned()
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                TableAlterStatement::new()
                    .table(AuthGrant::Table)
                    .modify_column(
                        ColumnDef::new(AuthGrant::Code)
                            .string()
                            .not_null()
                            .default("")
                    )
                    .to_owned()
                ).await
    }
}

#[derive(DeriveIden)]
enum AuthGrant {
    Table,
    Code,
}
