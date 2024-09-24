use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[derive(DeriveIden)]
enum Passport {
    Table,
    CeremonyTime,
}

#[derive(DeriveIden)]
enum Ceremonies {
    Table,
    CeremonyTime,
}

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                TableAlterStatement::new()
                    .table(Passport::Table)
                    .drop_column(Passport::CeremonyTime)
                    .add_column(
                        ColumnDef::new(Passport::CeremonyTime)
                            .timestamp()
                            .default("1970-01-01 00:00:00")
                            .not_null(),
                    )
                    .add_foreign_key(
                        TableForeignKey::new()
                            .name("fk_ceremony_time")
                            .to_tbl(Ceremonies::Table)
                            .to_col(Ceremonies::CeremonyTime)
                            .from_tbl(Passport::Table)
                            .from_col(Passport::CeremonyTime)
                            .on_delete(ForeignKeyAction::Cascade)
                            .on_update(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;
        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // Replace the sample below with your own migration scripts
        manager
            .alter_table(
                TableAlterStatement::new()
                    .table(Passport::Table)
                    .drop_column(Passport::CeremonyTime)
                    .add_column(
                        ColumnDef::new(Passport::CeremonyTime)
                            .string()
                            .default("1970-01-01 00:00:00")
                            .not_null(),
                    )
                    .to_owned(),
            )
            .await?;
        Ok(())
    }
}
