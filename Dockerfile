# Copied from https://github.com/leptos-rs/leptos-website/blob/main/Dockerfile
# Get started with a build env with Rust nightly
FROM rustlang/rust:nightly-alpine AS builder

RUN apk update
RUN apk add musl-dev openssl-libs-static openssl-dev binaryen zlib-dev zlib-static

ENV OPENSSL_STATIC=1 OPENSSL_LIB_DIR=/usr/lib OPENSSL_INCLUDE_DIR=/usr/include/openssl RUST_BACKTRACE=1 ZLIB_USE_STATIC_LIBS=ON

RUN rustup target add wasm32-unknown-unknown

# ENV RUSTFLAGS="-C link-args=-Wl,-Bstatic -C link-args=-lc"

# If you’re using stable, use this instead
# FROM rust:1.70-bullseye as builder

# Install cargo-binstall, which makes it easier to install other
# cargo extensions like cargo-leptos
RUN cargo install cargo-binstall

# Install cargo-leptos
RUN cargo binstall cargo-leptos -y
#RUN cargo install cargo-leptos

# Add the WASM target
RUN rustup target add wasm32-unknown-unknown

# Make an /app dir, which everything will eventually live in
RUN mkdir -p /app
WORKDIR /app
COPY . .

# Build the app
RUN cargo leptos build --release -vv

FROM rustlang/rust:nightly-bullseye AS runner
# Copy the server binary to the /app directory
COPY --from=builder /app/target/release/id /app/
# /target/site contains our JS/WASM/CSS, etc.
COPY --from=builder /app/target/site /app/site
# Copy Cargo.toml if it’s needed at runtime
COPY --from=builder /app/Cargo.toml /app/
WORKDIR /app

# Set any required env variables and
ENV RUST_LOG="info"
ENV APP_ENVIRONMENT="production"
ENV LEPTOS_SITE_ADDR="0.0.0.0:8080"
ENV LEPTOS_SITE_ROOT="site"
EXPOSE 8080

ARG POSTGRES_URL
ARG KV_URL
ENV POSTGRES_URL=${POSTGRES_URL}
ENV KV_URL=${KV_URL}
# Run the server
CMD ["/app/id"]
