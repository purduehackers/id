use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[derive(DeriveIden)]
enum Ceremonies {
    Table,
    CeremonyTime,
    TotalSlots,
    OpenRegistration,
}

#[derive(DeriveIden)]
enum Passport {
    Table,
    CeremonyTime,
}

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(Ceremonies::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(Ceremonies::CeremonyTime)
                            .timestamp()
                            .default("1970-01-01T00:00:00.000Z")
                            .not_null()
                            .primary_key(),
                    )
                    .col(
                        ColumnDef::new(Ceremonies::TotalSlots)
                            .integer()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(Ceremonies::OpenRegistration)
                            .boolean()
                            .not_null(),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .alter_table(
                TableAlterStatement::new()
                    .table(Passport::Table)
                    .modify_column(
                        ColumnDef::new(Passport::CeremonyTime)
                            .unique_key()
                    )
                    .add_foreign_key(
                        TableForeignKey::new()
                            .name("fk_ceremony_time")
                            .to_tbl(Passport::Table)
                            .to_col(Passport::CeremonyTime)
                            .from_tbl(Ceremonies::Table)
                            .from_col(Ceremonies::CeremonyTime)
                            .on_delete(ForeignKeyAction::Cascade)
                            .on_update(ForeignKeyAction::Cascade)
                    )
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(Ceremonies::Table).to_owned())
            .await?;

        manager
            .drop_foreign_key(
                ForeignKey::drop()
                .table(Passport::Table)
                .name("fk_ceremony_time")
                .to_owned(),
            )
            .await?;
        
        Ok(())
    }
}