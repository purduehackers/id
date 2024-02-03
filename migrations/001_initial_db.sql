CREATE SCHEMA IF NOT EXISTS ph_id;

CREATE TYPE ph_id.role as ENUM ('hacker', 'admin');

CREATE TABLE ph_id.user (
    id SERIAL PRIMARY KEY,
    discord_id BIGINT NOT NULL,
    role ph_id.role NOT NULL,
    UNIQUE(discord_id)
);

CREATE TABLE ph_id.passport (
    id SERIAL PRIMARY KEY,
    owner_id INT NOT NULL,
    version INT NOT NULL,
    sequence INT NOT NULL,
    surname VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    date_of_birth TIMESTAMP NOT NULL,
    date_of_issue TIMESTAMP NOT NULL,
    place_of_origin VARCHAR(255) NOT NULL,
    CONSTRAINT fk_user
        FOREIGN KEY (owner_id)
            REFERENCES ph_id.user(id)
            ON DELETE CASCADE
);
