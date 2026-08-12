# FileFlow single-VPS test deployment

This profile runs the FileFlow web frontend, API and dependencies on one small server. Only
Caddy exposes ports; PostgreSQL, Redis, MinIO and ClamAV stay private inside Docker.

## Server

- OVHcloud VPS-2
- 4 vCores, 8 GB RAM and 75 GB NVMe
- Ubuntu 24.04 LTS
- US East (Virginia)
- Primary IPv4 and IPv6
- no external object storage for this test

## One-time server setup

Create an `A` record for `api.fileflow.pro` pointing to the server IPv4 address. The frontend
and API then use only first-party FileFlow hostnames, avoiding dependency on public wildcard
DNS services.

Connect over SSH and install Docker:

```sh
apt-get update
apt-get install -y ca-certificates curl git
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

Clone FileFlow on the server and enter this directory. Build the static frontend, copy
`.env.example` to `.env`, replace the example API address with the `sslip.io` hostname
containing the real server IPv4, set `FILEFLOW_WEB_HOST` and `FILEFLOW_WEB_ORIGIN` to the
registered domain, set `FILEFLOW_SITES_ORIGIN` to the published Sites frontend origin, and
generate long random secrets:

```sh
NEXT_PUBLIC_API_URL=https://YOUR_DOMAIN/api/v1 \
NEXT_PUBLIC_SITE_URL=https://YOUR_DOMAIN pnpm build
cp .env.example .env
openssl rand -hex 32
openssl rand -hex 32
```

Keep only SSH, HTTP and HTTPS open in the host firewall. Start the stack:

```sh
docker compose up -d --build
docker compose ps
curl https://YOUR_DOMAIN/api/v1/health/live
curl https://YOUR_DOMAIN/api/v1/health/beta
```

The `beta` health endpoint must return `status: ready`. Point the domain's apex `A` record to
the server IPv4 and point `www` to the apex with a `CNAME` record. Caddy obtains and renews
HTTPS certificates automatically after DNS resolves to the server.

## Test limits

- maximum checked-cloud upload/import: 2 GiB
- direct-to-device social downloads: no FileFlow size ceiling; bounded by temporary server disk
- one safety scan at a time
- one processing/import task at a time
- one-hour application retention
- object cleanup every ten minutes for objects older than 75 minutes
- ten free cloud jobs per account per day

The cleanup window includes a 15-minute safety margin so an operation finishing near expiry is
not deleted immediately.

## Operations

Inspect service health and recent logs:

```sh
docker compose ps
docker compose logs --tail 100 api safety-worker processing-worker object-cleanup
df -h
docker stats --no-stream
```

Apply a new FileFlow revision:

```sh
git pull --ff-only
docker compose up -d --build
```

Create a manual database backup before updates:

```sh
mkdir -p backups
docker compose exec -T postgres pg_dump -U fileflow -d fileflow | gzip > "backups/fileflow-$(date +%F).sql.gz"
```

This test profile is deliberately single-node and has no off-server backup. Do not treat it as a
durable production environment.
