pub use sea_orm_migration::prelude::*;

mod m20220101_000001_create_table;
mod m20240205_172651_add_secret;
mod m20240205_193350_drop_sequence;
mod m20240206_145604_add_totp;
mod m20240210_064839_oauth_tables;
mod m20240304_164539_nullable_grant_code;

pub struct Migrator;

#[async_trait::async_trait]
impl MigratorTrait for Migrator {
    fn migrations() -> Vec<Box<dyn MigrationTrait>> {
        vec![
            Box::new(m20220101_000001_create_table::Migration),
            Box::new(m20240205_172651_add_secret::Migration),
            Box::new(m20240205_193350_drop_sequence::Migration),
            Box::new(m20240206_145604_add_totp::Migration),
            Box::new(m20240210_064839_oauth_tables::Migration),
            Box::new(m20240304_164539_nullable_grant_code::Migration),
        ]
    }
}
