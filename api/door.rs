use entity::passport;
use id::{wrap_error, PassportRecord, db};
use vercel_runtime::{run, Body, Error, Request, Response, StatusCode};
use entity::prelude::*;
use sea_orm::prelude::*;

#[tokio::main]
async fn main() -> Result<(), Error> {
    run(wrap_error!(handler)).await
}

pub async fn handler(req: Request) -> Result<Response<Body>, Error> {
    match req.body() {
        Body::Text(_) | Body::Empty => Err("Invalid body".to_string().into()),
        Body::Binary(b) => {
            let record: PassportRecord = serde_json::from_str(&String::from_utf8(b.to_vec())?)?;

            // Check if the passport exists and is valid
            let db = db().await?;
            let passport: Option<passport::Model> = Passport::find_by_id(record.id).one(&db).await?;

            match passport {
                Some(passport) => {
                    if !passport.activated {
                        let mut resp = Response::new(Body::Text("Passport disabled".to_string()));
                        *resp.status_mut() = StatusCode::FORBIDDEN;
                        Ok(resp)
                    } else if passport.secret != record.secret {
                        let mut resp = Response::new(Body::Text("Passport secret incorrect".to_string()));
                        *resp.status_mut() = StatusCode::UNAUTHORIZED;
                        Ok(resp)
                    } else {
                        Ok(Response::new(Body::Empty))
                    }
                },
                None => {
                    let mut resp = Response::new(Body::Text("Passport does not exist".to_string()));
                    *resp.status_mut() = StatusCode::NOT_FOUND;
                    Ok(resp)
                }
            }
        }
    }
}
