use totp_rs::{Secret, TOTP};

use crate::routes::RouteError;

fn default_totp(user_id: i32, secret: Vec<u8>) -> TOTP {
    TOTP {
        algorithm: totp_rs::Algorithm::SHA1,
        digits: 6,
        skew: 1,
        step: 30,
        secret,
        issuer: Some("Purdue Hackers".to_string()),
        account_name: user_id.to_string(),
    }
}

pub fn validate_totp(user_id: i32, secret: String, code: &str) -> Result<bool, RouteError> {
    let totp = default_totp(
        user_id,
        Secret::Encoded(secret)
            .to_bytes()
            .expect("secret to parse sucessfully"),
    );
    Ok(totp.check_current(code)?)
}
