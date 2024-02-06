use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[derive(DeriveIden)]
enum Passport {
    Table,
    Secret,
    Activated,
}

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                TableAlterStatement::new()
                    .table(Passport::Table)
                    .add_column(
                        ColumnDef::new(Passport::Secret)
                            .string()
                            .default("INSECURE")
                            .not_null(),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .alter_table(
                TableAlterStatement::new()
                    .table(Passport::Table)
                    .add_column(
                        ColumnDef::new(Passport::Activated)
                            .boolean()
                            .default(false)
                            .not_null(),
                    )
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                TableAlterStatement::new()
                    .table(Passport::Table)
                    .drop_column(Passport::Activated)
                    .to_owned(),
            )
            .await?;

        manager
            .alter_table(
                TableAlterStatement::new()
                    .table(Passport::Table)
                    .drop_column(Passport::Secret)
                    .to_owned(),
            )
            .await?;

        Ok(())
    }
}
