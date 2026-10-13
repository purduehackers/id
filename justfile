set shell := ["nu", "-c"]

db-push db:
    with-env { \
        TURSO_DATABASE_URL: (turso db show {{db}} --url | str trim) \
        TURSO_AUTH_TOKEN: (turso db tokens create {{db}} --expiration 1d | str trim) \
    } { deno task db:push }

db-shell db:
    turso db shell {{db}}
