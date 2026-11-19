# Authentication Scenario Matrix

This document is the source-of-truth test spec for auth behavior driven by ENV combinations.

It is based on current implementation in:

- `app/services/auth_mode_service.ts`
- `app/services/registration_policy_service.ts`
- `app/controllers/web/{bootstrap,login,register,password_reset,invite_registration,oidc}_controller.ts`
- `inertia/pages/auth/*`
- `inertia/pages/profile/show.vue`

## 1) ENV Axes

### Providers axis

`AUTH_PROVIDERS` supports `local`, `microsoft`, `discord`, and `oidc`.

Runtime rules:

- Parsed as comma list, case-insensitive, whitespace-trimmed.
- Unknown values are ignored.
- If empty/invalid after parsing, app falls back to `local`.
- The external providers appear in this order: `microsoft`, `discord`, `oidc`.

Canonical provider sets:

1. `local`
2. `microsoft`
3. `discord`
4. `microsoft,discord`
5. `local,microsoft`
6. `local,discord`
7. `local,microsoft,discord`

### Registration policy axis

`AUTH_REGISTRATION_MODE`:

- `open`
- `invite_only`
- `domain_auto_approve`

Runtime rules:

- Empty/invalid value falls back to `open`.

`AUTH_REGISTRATION_ALLOWED_DOMAINS`:

- Comma list used only when mode is `domain_auto_approve`.
- Case-insensitive domain match.
- If list is empty in `domain_auto_approve`, all self-registration is denied.

### OIDC auto-registration axis

`AUTH_AUTO_REGISTER_PROVIDERS`:

- Comma list (`microsoft`, `discord`).
- Controls whether unknown users can be created on first OIDC login for those providers.
- Independent from `AUTH_REGISTRATION_MODE=open/domain_auto_approve` for OIDC, except `invite_only` has special handling (see section 5).

### Generic OpenID Connect with a local administrator

Register Fridgora as a confidential OpenID Connect client with your identity provider. Give users access
to that client at the provider. Set the redirect URI to your public Fridgora URL plus
`/auth/oidc/callback`. Include any deployment path prefix.

```dotenv
AUTH_PROVIDERS=local,oidc
AUTH_LOCAL_ADMIN_ONLY=true
AUTH_AUTO_REGISTER_PROVIDERS=oidc
AUTH_REGISTRATION_MODE=open
AUTH_EMAIL_VERIFICATION_REQUIRED=false
AUTH_PROVIDER_OIDC_ISSUER=https://identity.example.com/your-issuer
AUTH_PROVIDER_OIDC_CLIENT_ID=fridgora
AUTH_PROVIDER_OIDC_CLIENT_SECRET=your-client-secret
MAIL_ENABLED=false
```

In this configuration `open` allows registration through the configured identity provider.
`AUTH_LOCAL_ADMIN_ONLY` blocks public local registration and restricts password sign-in to
administrators and kiosk devices. On a fresh installation, create the first administrator locally
at `/setup/bootstrap`.

OIDC users are identified by the issuer and subject, and can sign in even when the provider
omits the email claim. A verified email may be stored as a contact address. Set
`AUTH_PROVIDER_OIDC_SCOPES="openid profile"` to request no email claim. The token endpoint uses
`client_secret_basic` by default and supports `AUTH_PROVIDER_OIDC_TOKEN_AUTH_METHOD=client_secret_post`.

To use an existing
Fridgora account with the generic provider, link it in the profile before turning off password
sign-in for that user. Existing roles and purchases are then available under the linked login.

When `MAIL_ENABLED=false`, email delivery and password reset by email are disabled.
Administrators still sign in and change their passwords using their local credentials. Users
can enter a payout IBAN after reauthenticating through their configured sign-in method.

## 2) Global Preconditions and Shared Rules

1. First-admin bootstrap gate:

- If no admin exists, `GET /login` and `POST /login` redirect to `/setup/bootstrap`.
- `GET /register` and `POST /register` also redirect to `/setup/bootstrap`.

2. Guest middleware:

- Logged-in users hitting guest routes (`/login`, `/register`, `/forgot-password`, `/setup/bootstrap`, invite/register guest routes) are redirected to `/`.

3. Local-disabled behavior:

- If `local` is not enabled:
- Local credential flows are blocked (`/register`, `/forgot-password`, local invite POST).
- Login may auto-redirect to provider (single-provider condition below).

4. Single-provider auto-redirect on `/login`:

- Conditions: local disabled + exactly one external provider + no flashed `alert`.
- Result: `GET /login` redirects to `/auth/{provider}/redirect`.

5. Flash-sensitive `/login` behavior:

- If flashed `alert` exists, app renders login page instead of auto-redirecting.

## 3) Route Matrix by Provider Set

### A. `AUTH_PROVIDERS=local` (local-only)

Expected behavior:

- `/login`: renders local form (email/password/remember-me).
- `/login`: has links to `/forgot-password` and, when registration policy allows, `/register`.
- `/register`: allowed/blocked by registration mode.
- `/forgot-password`: available.
- `/register/invite/:token`: renders invite page with local password setup only.
- `/setup/bootstrap` (no admin): local bootstrap form visible; no OIDC buttons.
- `/profile`: no external-provider link buttons.

### B. `AUTH_PROVIDERS=microsoft` (provider-only, single)

Expected behavior:

- `/login` (no alert): redirects to `/auth/microsoft/redirect`.
- `/login` (with alert): renders login shell with Microsoft button, no local fields.
- `/register`: redirects to `/login`.
- `/forgot-password`: redirects to `/login`.
- `/register/invite/:token` (valid invite): redirects to `/auth/microsoft/redirect?intent=invite&token=...`.
- `/setup/bootstrap` (no admin): no local form; Microsoft bootstrap button available.
- `/profile`: Microsoft link button available (disabled when already linked).

### C. `AUTH_PROVIDERS=discord` (provider-only, single)

Same as section B, replacing Microsoft with Discord. Or any other future OIDC provider.

### D. `AUTH_PROVIDERS=microsoft,discord` (provider-only, multi)

Expected behavior:

- `/login`: does not auto-redirect; renders provider selection with Microsoft + Discord.
- `/register`: redirects to `/login`.
- `/forgot-password`: redirects to `/login`.
- `/register/invite/:token` (valid invite): renders invite page with provider buttons; no local password form.
- `/setup/bootstrap` (no admin): renders provider bootstrap buttons for both providers; no local form.
- `/profile`: both link buttons shown.

### E. `AUTH_PROVIDERS=local,microsoft` (hybrid single external)

Expected behavior:

- `/login`: renders local form plus Microsoft button (no auto-redirect because local enabled).
- `/register` and `/forgot-password`: available (subject to registration policy).
- `/register/invite/:token`: renders local invite form + Microsoft invite button.
- `/setup/bootstrap` (no admin): local bootstrap form + Microsoft bootstrap button.
- `/profile`: Microsoft link button shown.

### F. `AUTH_PROVIDERS=local,discord` (hybrid single external)

Same as section E, replacing Microsoft with Discord. Or any other future OIDC provider.

### G. `AUTH_PROVIDERS=local,microsoft,discord` (hybrid multi external)

Expected behavior:

- `/login`: local form + both provider buttons.
- `/register` and `/forgot-password`: available (subject to registration policy).
- `/register/invite/:token`: local invite form + both provider invite buttons.
- `/setup/bootstrap` (no admin): local form + both provider bootstrap buttons.
- `/profile`: both link buttons shown.

## 4) Registration Policy Matrix (Self-Registration)

Applies to local `POST /register` and to OIDC first-login self-registration checks.

### `AUTH_REGISTRATION_MODE=open`

- Local `POST /register`: allowed when local is enabled.
- OIDC first-login: allowed (subject to provider and identity constraints).

### `AUTH_REGISTRATION_MODE=invite_only`

- Local `POST /register`: blocked, redirect `/login`, flash `registration_not_allowed`.
- OIDC first-login:
- If invite intent token is valid and email matches provider email, allowed.
- If no invite intent, but active invite exists for provider email, allowed.
- Otherwise blocked with `login_not_registered`.

### `AUTH_REGISTRATION_MODE=domain_auto_approve`

- Local `POST /register`: allowed only if email domain is in `AUTH_REGISTRATION_ALLOWED_DOMAINS`.
- OIDC first-login: same domain rule for provider email.
- Empty domain list means deny all self-registration.

## 5) OIDC First-Login Creation Decision Matrix

For unknown user logging in via provider callback:

Allowed user creation when any of these is true:

1. Provider is listed in `AUTH_AUTO_REGISTER_PROVIDERS`.
2. Bootstrap intent is active and no admin exists.
3. Valid invite intent is active and invite email matches provider email.
4. Registration policy allows self-registration (`open`, or domain match in `domain_auto_approve`, or invite lookup success in `invite_only`).

Denied creation when:

- Provider email missing for Microsoft or Discord. The generic OIDC provider allows a missing email for automatic registration.
- Provider user id missing.
- Registration denied and no valid invite fallback.
- Invite intent token email does not match provider email.
- Ambiguous local email match or provider conflict.

On successful creation:

- Role is:
- `admin` when bootstrap intent is active.
- invite role when invitation is used.
- otherwise `customer` (or `admin` only in empty-admin bootstrap path).
- Linked identity is stored.
- User is logged in and redirected to `/shop`.

## 6) Invite Flow Matrix (`/register/invite/:token`)

For guest with token:

1. Invalid/expired/revoked/already accepted token:

- Redirect `/login` with `invite_invalid_or_expired`.

2. Local enabled:

- `GET`: render invite page with email/role, local password form, plus external provider buttons if configured.
- `POST`: local password acceptance path enabled.

3. Local disabled + exactly one external provider:

- `GET`: redirect to `/auth/{provider}/redirect?intent=invite&token=...`.
- `POST`: blocked (redirect `/login`).

4. Local disabled + multiple external providers:

- `GET`: render invite page with provider buttons only.
- `POST`: blocked (redirect `/login`).

## 7) Bootstrap Flow Matrix (`/setup/bootstrap`)

Precondition: no admin exists.

1. Local enabled:

- Local bootstrap form available.
- If external providers also enabled, corresponding OIDC bootstrap buttons shown.
- Successful local submit creates first admin and logs in.

2. Local disabled:

- Local form hidden.
- External bootstrap buttons shown if providers enabled.
- `POST /setup/bootstrap` local submit path is rejected with flash `bootstrap_local_disabled`.

After first admin exists:

- `/setup/bootstrap` redirects to `/login`.

## 8) Login Page UI Matrix

`GET /login` rendered page content by mode:

1. Local enabled:

- Local email/password form shown.
- Submit disabled until client validations pass.
- `Forgot password` link shown.
- `Create account` link shown only when registration mode is `open` or `domain_auto_approve`.

2. Local disabled:

- Local fields hidden.
- One provider only:
- typically redirects away (unless flash alert exists).
- Multiple providers:
- provider buttons shown.

3. External providers enabled (any mode):

- Provider buttons shown in rendered login view.

## 9) Profile Linking Matrix

In `/profile`:

- Link buttons are shown for currently enabled external providers only.
- Button for already-linked provider is disabled and labeled as linked.
- Clicking link starts `/auth/{provider}/redirect?intent=link&userId={currentUserId}`.

## 10) Minimal Exhaustive Test Set (Recommended)

To avoid a literal cartesian explosion, use these equivalence classes:

1. Provider sets (7 total):

- `local`
- `microsoft`
- `discord`
- `microsoft,discord`
- `local,microsoft`
- `local,discord`
- `local,microsoft,discord`

2. Registration modes (3 total):

- `open`
- `invite_only`
- `domain_auto_approve` with at least one allowed domain and one denied domain case

3. Auto-register modes per provider:

- none
- microsoft only
- discord only
- both

4. User state axes:

- no admin exists vs admin exists
- guest vs authenticated
- known user vs unknown user
- valid invite vs invalid invite vs invite-email-mismatch

5. Assertions per scenario:

- HTTP status + `Location` header
- Rendered page markers (local fields, provider buttons, links)
- User creation side effects (role, linked identity)
- Flash message type/key where meaningful

This gives full behavioral coverage with manageable test count while still being strict and deterministic.

## 11) Example ENV Profiles

### Local-only open registration

```env
AUTH_PROVIDERS=local
AUTH_AUTO_REGISTER_PROVIDERS=
AUTH_REGISTRATION_MODE=open
AUTH_REGISTRATION_ALLOWED_DOMAINS=
```

### Microsoft-only SSO (auto redirect)

```env
AUTH_PROVIDERS=microsoft
AUTH_AUTO_REGISTER_PROVIDERS=microsoft
AUTH_REGISTRATION_MODE=invite_only
AUTH_REGISTRATION_ALLOWED_DOMAINS=
```

### Hybrid local + OIDC with domain policy

```env
AUTH_PROVIDERS=local,microsoft,discord
AUTH_AUTO_REGISTER_PROVIDERS=discord
AUTH_REGISTRATION_MODE=domain_auto_approve
AUTH_REGISTRATION_ALLOWED_DOMAINS=example.com,company.local
```

### Notes

- Invitation and password reset TTLs are separate knobs:
- `INVITE_EXPIRY_HOURS`
- `PASSWORD_RESET_TTL_MINUTES`
