use sea_orm::{EnumIter, Iterable};
use sea_orm_migration::{prelude::*, sea_query::extension::postgres::Type};

#[derive(DeriveMigrationName)]
pub struct Migration;

#[derive(DeriveIden)]
enum User {
    Table,
    Id,
    DiscordId,
    Role,
}

#[derive(DeriveIden)]
enum Passport {
    Table,
    Id,
    OwnerId,
    Version,
    Sequence,
    Surname,
    Name,
    DateOfBirth,
    DateOfIssue,
    PlaceOfOrigin,
}

#[derive(DeriveIden)]
struct RoleEnum;

#[derive(DeriveIden, EnumIter)]
enum RoleVariants {
    Hacker,
    Admin,
}

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_type(
                Type::create()
                    .as_enum(RoleEnum)
                    .values(RoleVariants::iter())
                    .to_owned(),
            )
            .await?;

        manager
            .create_table(
                Table::create()
                    .table(User::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(User::Id)
                            .integer()
                            .not_null()
                            .auto_increment()
                            .primary_key(),
                    )
                    .col(
                        ColumnDef::new(User::DiscordId)
                            .big_integer()
                            .not_null()
                            .unique_key(),
                    )
                    .col(
                        ColumnDef::new(User::Role)
                            .enumeration(RoleEnum, RoleVariants::iter())
                            .not_null(),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_table(
                Table::create()
                    .table(Passport::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(Passport::Id)
                            .integer()
                            .not_null()
                            .auto_increment()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(Passport::OwnerId).integer().not_null())
                    .col(ColumnDef::new(Passport::Version).integer().not_null())
                    .col(ColumnDef::new(Passport::Sequence).integer().not_null())
                    .col(ColumnDef::new(Passport::Surname).string().not_null())
                    .col(ColumnDef::new(Passport::Name).string().not_null())
                    .col(ColumnDef::new(Passport::DateOfBirth).date().not_null())
                    .col(ColumnDef::new(Passport::DateOfIssue).date().not_null())
                    .col(ColumnDef::new(Passport::PlaceOfOrigin).string().not_null())
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_passport_owner")
                            .to(User::Table, User::Id)
                            .from(Passport::Table, Passport::OwnerId)
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
            .drop_table(Table::drop().table(Passport::Table).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table(User::Table).to_owned())
            .await?;
        manager
            .drop_type(Type::drop().name(RoleEnum).to_owned())
            .await?;

        Ok(())
    }
}
