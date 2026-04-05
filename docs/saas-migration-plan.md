# Joony Real Estate SaaS Migration Plan

## Goal

Turn the current DNETH management app into a reusable SaaS platform that supports:

- account-specific subdomains such as `nic.joonyrealestate.com`
- custom domains such as `dnethmanagement.com`
- separate frontend and backend repositories
- frontend hosting on CloudFront
- backend hosting on EC2 / ALB
- safe migration of the existing DNETH client without a risky big-bang rewrite

## Current State

### DNETH app

Current DNETH code lives in one monorepo:

- backend: `/Users/joony/Desktop/dnenth-management/dneth-server`
- frontend: `/Users/joony/Desktop/dnenth-management/dneth-server/client`

Current production shape:

- frontend and backend are deployed together from the same EC2 host
- Express serves the built SPA from `client/dist`
- auth uses `passport` + `cookie-session`
- there is no first-class SaaS account model
- there is no hostname or subdomain based account resolution

### Joony Real Estate web

Current Joony Real Estate web project lives at:

- `/Users/joony/Desktop/joonyrealestate/joonyrealestate-web`

This currently looks like a landing / marketing site, not the management product app.

## Product Naming Decision

Do **not** introduce a new SaaS model named `Tenant`, because `Tenant` already means renter/occupant in the DNETH domain model.

Use:

- `Account`

Recommended meaning:

- SaaS customer / company / workspace = `Account`
- renter / occupant = existing `Tenant`

Examples:

- DNETH Apartment = account `dneth`
- Nic = account `nic`
- David = account `david`

## Target Platform Shape

### Repositories

Target repo split:

1. `joonyrealestate-web`
   - marketing site only
   - public landing pages
   - pricing / onboarding / contact

2. `joonyrealestate-app`
   - management frontend app
   - extracted from current `dneth-server/client`
   - served from CloudFront

3. `joonyrealestate-api`
   - backend API
   - extracted from current `dneth-server`
   - served from EC2 / ALB

### Domains

Recommended domain structure:

- `joonyrealestate.com`
  - marketing site
- `app.joonyrealestate.com`
  - optional shared app entry point
- `*.joonyrealestate.com`
  - customer app subdomains
- `api.joonyrealestate.com`
  - backend API

Examples:

- `dneth.joonyrealestate.com`
- `nic.joonyrealestate.com`
- `david.joonyrealestate.com`

### Custom domains

Each account can also own custom domains:

- `dnethmanagement.com` -> account `dneth`

This means DNETH keeps its branded domain while the platform still supports slug-based onboarding.

## Required Core Platform Model

Add a new backend model:

```ts
Account {
  _id: ObjectId
  name: string
  slug: string
  customDomains: string[]
  status: 'active' | 'inactive'
  createdAt: Date
  createdBy?: string
  settings?: {
    defaultLanguage?: string
    defaultCurrency?: string
    timezone?: string
  }
}
```

Recommended rules:

- `slug` must be globally unique
- `customDomains` must be globally unique
- normalize custom domains to lowercase
- support both apex and `www`

## Data Model Changes

### Phase 1 minimum

Add `accountId` to:

- `users`
- `buildings`

This is the minimum needed to introduce hard account boundaries without immediately rewriting everything.

### Phase 2 recommended

Add `accountId` to all operational collections:

- `rooms`
- `tenants`
- `stays`
- `meterreadings`
- `invoices`
- `payments`
- `expenses`
- `services`
- `documents`

This makes queries safer, faster, and easier to reason about in a multi-tenant system.

### Why this matters

Right now many queries are scoped only by `buildingId`.
That works for a single-customer deployment, but it is not a complete SaaS isolation boundary.

In the target state:

- account is the outer authorization boundary
- buildings are an inner business object within the account

## Hostname Resolution

Add request middleware that resolves account context from the incoming host.

Resolution order:

1. custom domain match
2. subdomain slug match
3. optional development fallback

Pseudo-flow:

```ts
Host: dnethmanagement.com -> Account(customDomains includes host)
Host: nic.joonyrealestate.com -> Account(slug === 'nic')
Host: david.joonyrealestate.com -> Account(slug === 'david')
```

Middleware should:

- read `x-forwarded-host` first when behind ALB / proxy
- fall back to `host`
- strip ports
- lowercase the hostname
- attach `req.account`

Suggested request shape:

```ts
type AccountContext = {
  id: string
  slug: string
  name: string
}
```

## Authorization Model

Current DNETH auth is user-based plus building-access based.
That should evolve to:

1. account boundary check
2. role check
3. building access check

Desired rule:

- a user can only authenticate into one account context at a time
- every request is first scoped to `req.account`
- the authenticated user must belong to the same `accountId`
- then role / building permissions are applied

## Authentication Recommendation

Current auth:

- `passport`
- server session
- `cookie-session`

This is workable today, but it becomes awkward once:

- frontend is on CloudFront
- backend is on `api.joonyrealestate.com`
- some customers use custom domains

### Recommended target auth

Move to token-based auth:

- short-lived access token
- refresh token
- account-aware login response

Why:

- simpler across separate frontend/backend origins
- easier with CloudFront + API separation
- easier to support both custom domains and slug domains

### Migration advice

Do not switch auth first.
First introduce the `Account` model and account scoping in the current architecture.
Then move auth during the repo/deployment split.

## Frontend Strategy

### Recommendation

Use the current DNETH frontend as the starting point for `joonyrealestate-app`.

Reason:

- it already contains the actual operations workflows
- it is much more complete than the current `joonyrealestate-web`
- the existing `joonyrealestate-web` is better kept as the marketing site

### Target frontend behavior

At app boot:

1. derive the current account from hostname
2. call an account bootstrap endpoint
3. load branding / settings / auth state
4. render the app shell

Useful bootstrap response:

```ts
{
  account: {
    id: string
    slug: string
    name: string
    branding?: {
      logoUrl?: string
      primaryColor?: string
    }
  },
  auth: {
    user: { ... } | null
  }
}
```

## Backend Strategy

### Recommendation

Use the current DNETH backend as the starting point for `joonyrealestate-api`.

Reason:

- the product logic is already here
- it already supports roles, buildings, rooms, stays, invoices, payments, and reports
- the biggest missing piece is account isolation, not business functionality

### Required backend additions

1. `Account` model
2. account resolver middleware
3. account-aware auth
4. account scoping in all queries
5. account-aware onboarding / provisioning scripts

## Infrastructure Target

### Frontend

- S3 + CloudFront
- one app build
- domain-based runtime configuration

### Backend

- EC2 behind ALB
- `api.joonyrealestate.com`
- TLS via ACM

### DNS

Recommended:

- wildcard record for `*.joonyrealestate.com`
- explicit record for `api.joonyrealestate.com`
- custom domains mapped per account

### DNETH domain handling

DNETH should be configured as:

- slug: `dneth`
- custom domain: `dnethmanagement.com`

That lets DNETH continue using its existing brand while still living on the same SaaS platform as Nic and David.

## Migration Phases

## Phase 0: Blueprint and safety

Objective:

- define the target shape without breaking production

Tasks:

- finalize naming: `Account`
- define account and domain rules
- decide auth migration timing
- list all collections that need `accountId`

## Phase 1: Multi-tenant core inside current monorepo

Objective:

- make the current backend account-aware before splitting repos

Tasks:

1. add `Account` model
2. add `accountId` to `User` and `Building`
3. create DNETH account record
4. backfill DNETH users and buildings to that account
5. add hostname/account resolver middleware
6. attach `req.account`
7. enforce `req.user.accountId === req.account.id`
8. scope building list/detail queries by `accountId`

Success criteria:

- DNETH still works at `dnethmanagement.com`
- same codebase can resolve account context cleanly

## Phase 2: Full account propagation

Objective:

- make operational data explicitly account-scoped

Tasks:

1. add `accountId` to all operational collections
2. backfill from building ownership
3. update create/update services so new records always inherit `accountId`
4. add indexes like:
   - `{ accountId: 1, _id: 1 }`
   - `{ accountId: 1, buildingId: 1 }`
   - `{ accountId: 1, date: -1 }`

Success criteria:

- all core queries can be constrained by `accountId`
- cross-account leakage risk is reduced dramatically

## Phase 3: Extract backend repo

Objective:

- separate the API from the monorepo

Tasks:

1. create `joonyrealestate-api`
2. move server code there
3. remove static SPA serving from Express
4. move env / deployment scripts
5. deploy API separately on EC2 / ALB

Success criteria:

- API runs independently from the frontend build

## Phase 4: Extract frontend repo

Objective:

- separate the management frontend from the monorepo

Tasks:

1. create `joonyrealestate-app`
2. move current `client/` there
3. point API base URL to `api.joonyrealestate.com`
4. add hostname-aware bootstrap logic
5. deploy to S3 + CloudFront

Success criteria:

- frontend is static-hosted and talks to the backend over HTTP

## Phase 5: Auth migration

Objective:

- replace session coupling with SaaS-friendly auth

Tasks:

1. add token-based login / refresh flow
2. update frontend auth storage and refresh logic
3. deprecate session-cookie dependence

Success criteria:

- auth works reliably across:
  - `nic.joonyrealestate.com`
  - `david.joonyrealestate.com`
  - `dnethmanagement.com`

## Phase 6: New customer onboarding

Objective:

- onboard new customers on the SaaS model

Tasks:

1. create account `nic`
2. create account `david`
3. create users, buildings, and seed settings per account
4. point `nic.joonyrealestate.com` and `david.joonyrealestate.com` to the app

Success criteria:

- Nic and David are launched on the new platform
- DNETH continues to function on its custom domain

## Recommended Cutover Order

Use this order:

1. DNETH becomes the first `Account` inside the current app
2. verify DNETH still works
3. split backend
4. split frontend
5. migrate auth
6. onboard Nic and David onto the new stack

This is safer than trying to launch Nic and David while the platform foundation is still moving underneath DNETH.

## Risks

### 1. Naming collision

Risk:

- `Tenant` already means renter

Mitigation:

- use `Account` for SaaS customer

### 2. Cross-account data leaks

Risk:

- old queries may not be account-scoped

Mitigation:

- add `accountId`
- add shared account guard middleware
- review every route that reads or writes business data

### 3. Auth breakage across custom domains

Risk:

- session cookies become fragile when frontend and backend are split

Mitigation:

- migrate to token auth during repo split

### 4. DNETH production disruption

Risk:

- custom domain client is already live

Mitigation:

- make DNETH the first account in-place before repo split
- do not force a big-bang migration

## Immediate Next Milestone

Implement **Phase 1** in the current DNETH monorepo:

1. create `Account` model
2. add `accountId` to `User` and `Building`
3. add account resolver middleware
4. create DNETH account seed / migration
5. scope building list/detail routes by account

This is the smallest high-value step that moves the product toward SaaS without forcing the repo split yet.

## Suggested Seed Data For Day One

```ts
Account {
  name: "Dneth Apartment",
  slug: "dneth",
  customDomains: ["dnethmanagement.com", "www.dnethmanagement.com"],
  status: "active"
}

Account {
  name: "Nic",
  slug: "nic",
  customDomains: [],
  status: "active"
}

Account {
  name: "David",
  slug: "david",
  customDomains: [],
  status: "active"
}
```

Nic and David do not need to be activated in production immediately.
They can exist as future accounts while the DNETH migration is being validated.

## GitHub Repositories To Create

Create these repositories:

1. `joonyrealestate-web`
   - marketing website
   - keep / move the current landing-site code here

2. `joonyrealestate-app`
   - management frontend
   - extracted from current `dneth-server/client`

3. `joonyrealestate-api`
   - backend API
   - extracted from current `dneth-server`

Optional later:

4. `joonyrealestate-infra`
   - Terraform / CloudFormation / deployment scripts
   - only if you want infrastructure as code in a separate repo

## AWS Console Setup Checklist

### Route 53

Create or confirm:

- hosted zone for `joonyrealestate.com`
- DNS records for:
  - `joonyrealestate.com`
  - `www.joonyrealestate.com`
  - `api.joonyrealestate.com`
  - wildcard `*.joonyrealestate.com`

### ACM Certificates

Create certificates for:

- `joonyrealestate.com`
- `www.joonyrealestate.com`
- `*.joonyrealestate.com`
- `api.joonyrealestate.com`
- later: custom domains like `dnethmanagement.com`

### S3

Create buckets for static frontend hosting:

- one bucket for `joonyrealestate-web`
- one bucket for `joonyrealestate-app`

Recommended naming example:

- `joonyrealestate-web-prod`
- `joonyrealestate-app-prod`

### CloudFront

Create distributions for:

1. marketing distribution
   - origin: `joonyrealestate-web` bucket
   - domains:
     - `joonyrealestate.com`
     - `www.joonyrealestate.com`

2. app distribution
   - origin: `joonyrealestate-app` bucket
   - domains:
     - `*.joonyrealestate.com`
     - later custom customer domains

### EC2 / ALB

For the backend create or confirm:

- EC2 instance or Auto Scaling group for `joonyrealestate-api`
- Application Load Balancer
- target group for the API
- HTTPS listener on the ALB
- domain:
  - `api.joonyrealestate.com`

### IAM

Create or confirm:

- deploy user / role for frontend uploads to S3 + CloudFront invalidation
- deploy user / role for backend deployment to EC2
- app runtime role for API access to S3 / SES if needed

### Secrets / Configuration

Store environment configuration in a proper secret/config system:

- Mongo URI
- cookie / token secrets
- AWS access or IAM role strategy
- app base domain
- default account slug for local/dev if needed

Recommended place:

- AWS Systems Manager Parameter Store
  or
- AWS Secrets Manager
