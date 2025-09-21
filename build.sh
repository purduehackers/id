#!/usr/bin/env bash

cd "$(dirname $0)"

. .env
docker build -t id:latest --build-arg POSTGRES_URL="${POSTGRES_URL:?}" --build-arg KV_URL="${KV_URL:?}" .
