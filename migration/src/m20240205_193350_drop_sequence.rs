use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[derive(DeriveIden)]
enum Passport {
    Table,
    Sequence,
}

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager.alter_table(
            TableAlterStatement::new()
                .table(Passport::Table)
                .drop_column(Passport::Sequence)
                .to_owned()
        ).await?;
       
        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager.alter_table(
             TableAlterStatement::new()
                .table(Passport::Table)
                .add_column(
                    ColumnDef::new(Passport::Sequence)
                        .integer()
                        .not_null()
                )
                .to_owned() 
        ).await?;
       
        Ok(())
    }
}

