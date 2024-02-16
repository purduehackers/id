use totp_rs::TOTP;

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

pub fn validate_totp(user_id: i32, secret: &str, code: &str) -> Result<bool, vercel_runtime::Error> {
    let totp = default_totp(user_id, secret.as_bytes().to_vec());
    Ok(totp.check_current(code)?)
}
