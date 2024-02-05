//! `SeaORM` Entity. Generated by sea-orm-codegen 0.12.12

use super::sea_orm_active_enums::RoleEnum;
use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Eq)]
#[sea_orm(table_name = "user")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i32,
    #[sea_orm(unique)]
    pub discord_id: i64,
    pub role: RoleEnum,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(has_many = "super::passport::Entity")]
    Passport,
}

impl Related<super::passport::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Passport.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
