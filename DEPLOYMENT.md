# Deployment Baseline

This starter supports a deliberately small production contract:

- one backend service
- one dashboard origin
- same-origin avatar delivery from `/uploads/*`
- a reverse proxy in front of the apps

That is the supported baseline. Split-origin assets, shared rate-limit stores, and multi-instance upload storage are intentionally deferred.

## Deployable Artifacts

Production Docker baselines are included for:

- `apps/backend/Dockerfile`
- `apps/dashboard/Dockerfile`
- `apps/landing/Dockerfile`

The backend handles API traffic and writes uploads to disk. The dashboard and landing apps build to static assets and run behind nginx.

## Reverse Proxy Contract

The dashboard and avatar URLs are expected to share the same public origin.

Example nginx shape:

```nginx
server {
    server_name app.example.com;

    location /uploads/ {
        alias /srv/saas/uploads/;
        expires 1h;
        add_header Cache-Control "public";
    }

    location /api/ {
        proxy_pass http://backend:3005;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Request-Id $request_id;
    }

    location / {
        proxy_pass http://dashboard:8080;
    }
}
```

Set `TRUST_PROXY` to the reverse-proxy hop count you actually deploy behind so Express and `express-rate-limit` interpret client IPs correctly.

## Uploads

Avatar URLs are stored as public paths such as `/uploads/avatars/<file>`.

That means:

- the upload directory must be persistent
- the reverse proxy must have access to the upload volume if it serves `/uploads` directly
- object storage or split-origin assets require a different contract than the default starter

## Rate Limiting

The baseline production setup is:

- Better Auth handles auth-route throttling on `/api/auth/*`
- `express-rate-limit` handles normal API routes
- Redis-backed shared state is deferred until you need multi-instance deployment

When shared storage becomes necessary, prefer a standard store such as `rate-limit-redis` rather than a homegrown abstraction.
