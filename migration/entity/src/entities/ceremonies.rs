//! `SeaORM` Entity, @generated by sea-orm-codegen 1.0.0-rc.5

use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Eq, Serialize, Deserialize)]
#[sea_orm(table_name = "ceremonies")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub ceremony_time: DateTime,
    pub total_slots: i32,
    pub open_registration: bool,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(has_one = "super::passport::Entity")]
    Passport,
}

impl Related<super::passport::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Passport.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
