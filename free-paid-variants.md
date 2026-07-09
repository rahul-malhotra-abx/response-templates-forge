# Free vs Paid variant setup (single codebase)

This project now supports both variants from the same source code.

## Manifests

- Paid: `manifest.paid.yml`
- Free: `manifest.free.yml`

Update `app.id` in `manifest.free.yml` before first free deploy.

## Angular variant builds

- Paid UI build: `npm run ui:build:paid`
- Free UI build: `npm run ui:build:free`

Variant switch is controlled by Angular file replacement:

- Paid -> `src/app/environment.paid.ts`
- Free -> `src/app/environment.free.ts`

Both use shared settings in `src/app/environment.base.ts`.

## Deploy/install commands

### Paid

- `npm run deploy:paid`
- `npm run forge:install:paid`
- `npm run forge:upgrade:paid`
- `npm run tunnel:paid`

### Free

- `npm run deploy:free`
- `npm run forge:install:free`
- `npm run forge:upgrade:free`
- `npm run tunnel:free`

## Recommended flow

1. Build UI for variant.
2. Deploy with matching manifest.
3. Install/upgrade with matching manifest.

Example (free):

```bash
npm run ui:build:free
npm run deploy:free
npm run forge:upgrade:free
```
