# Joony Real Estate Server

Backend API for the Joony Real Estate SaaS platform.

## What This Repo Is

This repository is the extracted backend from the DNETH monorepo.
It is API-only and does not serve the frontend build.

## Environment Variables

Copy `.env.example` to `.env` and set:

- `PORT`
- `MONGO_URI`
- `COOKIE_KEY_1`
- `COOKIE_KEY_2`
- `COOKIE_KEY_3`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `S3_BUCKET_NAME`
- `APP_BASE_DOMAIN`
- `DEFAULT_ACCOUNT_SLUG`

## Scripts

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run account:bootstrap:dneth`
- `npm run account:backfill:operational`

## Deployment Notes

Recommended production shape:

- API domain: `api.joonyrealestate.com`
- ALB health check path: `/health`
- frontend hosted separately on CloudFront

## Current Phase

This backend already includes:

- Phase 1 account model and host resolution
- Phase 2 account propagation to operational collections

Next platform step after this extraction is connecting the new `joonyrealestate-app` frontend to this API.
