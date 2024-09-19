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

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(Ceremonies::Table).to_owned())
            .await?;

        
        Ok(())
    }
}