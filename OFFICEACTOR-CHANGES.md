# OfficeActor changes

This fork of [Postiz](https://github.com/gitroomhq/postiz-app) adds what
[OfficeActor](https://officeactor.de) needs to run Postiz for its customers.
This file lists every change against the original project, so upstream releases
can be merged with little effort. Keep it current with every change.

Rules: configure through environment variables before changing code, add new
files instead of rewriting existing ones, and hide features instead of deleting
files. Logic goes into new files under `officeactor/`; a changed line in an
upstream file carries the comment `OfficeActor:`, so
`grep -rn "OfficeActor:" apps libraries` lists the spots after an update.

Based on the upstream release v2.25.1 (merged on 2026-10-16).

## Changed upstream files

| File | Change | Reason |
| --- | --- | --- |
| `apps/backend/src/app.module.ts` | Imports `OfficeActorModule` (one import line, one entry in `imports`). | Mounts the OfficeActor bridge without touching `ApiModule`'s controller lists or its `AuthMiddleware`. |
| `apps/backend/src/services/auth/providers/oauth.provider.ts` | `getUser` rejects a userinfo response without a non-empty `sub` and `email`. | Users are looked up by `providerId`; an undefined `sub` drops that filter and would sign in an arbitrary `GENERIC` user. |
| `apps/frontend/src/proxy.ts` | Calls `officeActorSignIn` after the `/auth/logout` handling (one import, four lines). | Sign-in through OfficeActor as plain server redirects, without a Postiz page in between (see below). |
| `libraries/react-shared-libraries/src/helpers/variable.context.tsx` | Optional `logoutUrl` variable. | Passes `POSTIZ_LOGOUT_URL` to the logout button. |
| `apps/frontend/src/app/(app)/layout.tsx` | Passes `POSTIZ_LOGOUT_URL` as `logoutUrl`. | As above. |
| `apps/frontend/src/components/layout/logout.component.tsx` | After logging out, goes to `logoutUrl` when set, otherwise `/` as before. | Logging out of Postiz also ends the OfficeActor session; otherwise automatic sign-in would log the user straight back in. |
| `apps/frontend/src/components/new-layout/layout.component.tsx` | Renders neither the impersonation bar (nor its top padding of the left menu) nor the posting streak with its separator. | OfficeActor's customers and admins do not act as other users; the streak is not part of the offer. |
| `apps/frontend/src/components/settings/global.settings.tsx` | Leaves out the sign-in method and "Delete Account". | Sign-in and accounts belong to OfficeActor; deleting would detach the user from its OfficeActor identity. |
| `apps/frontend/src/components/settings/teams.component.tsx` | `canManageMembers = false` hides the invitation text, "Add another member" and "Remove"; the member list stays. | Members come from OfficeActor's projects. |
| `apps/frontend/src/app/global.scss` | Loads `officeactor.theme.scss` right after `colors.scss` (one `@use` line). | OfficeActor's colors (see Branding below). |
| `apps/frontend/src/app/(app)/layout.tsx` | Renders `OfficeActorTitle` in `<head>`. | "OfficeActor" instead of "Postiz" in the browser tab. |
| `apps/frontend/src/components/new-layout/logo.tsx` | `Logo` renders `OfficeActorMark` in the upstream logo's footprint. | OfficeActor's logo in the left menu and on `/oauth/authorize`. |
| `apps/frontend/src/components/ui/logo-text.component.tsx` | `LogoTextComponent` renders `OfficeActorMark`. | OfficeActor's logo on the sign-in and billing screens. |
| `apps/frontend/src/app/(app)/(preview)/p/[id]/page.tsx` | `OfficeActorMark` instead of `/postiz.svg` and the Postiz name; the title is "OfficeActor Preview". | OfficeActor's logo on shared post previews, and its name in their link previews, which run no script. |
| `apps/frontend/src/components/analytics/chart-social.tsx` | The `purple` scheme is OfficeActor's pink. | The chart is drawn on a canvas, which the CSS theme does not reach. |
| `apps/frontend/public/favicon.ico` | Replaced by OfficeActor's favicon (`FE/public/favicon-v5.ico` in OfficeActor's repository). | Browser tab icon. |
| `apps/frontend/public/no-channels-colors.svg`, `apps/frontend/public/peoplemarketplace.svg` | Purple replaced by pink tints, pink and Meerblau. | Illustrations shown as `<img>`, which the CSS theme does not reach. |

## Added files

| File | Purpose |
| --- | --- |
| `apps/backend/src/officeactor/officeactor.module.ts` | Registers the bridge controller, guard, service and repository and the open controller, and applies `OfficeActorBlockedMiddleware`; mounts nothing in `MCP_ONLY` mode, like `ApiModule`. |
| `apps/backend/src/officeactor/officeactor.blocked.middleware.ts` | Refuses upstream routes for actions OfficeActor manages with 403 (see below), without changing their controllers. |
| `apps/frontend/src/officeactor/officeactor.proxy.ts` | Sign-in through OfficeActor on the server: redirect to OfficeActor, redeem the returned code, loop guard (see below). |
| `apps/backend/src/officeactor/officeactor.guard.ts` | Requires `Authorization: Bearer <OFFICEACTOR_BRIDGE_SECRET>`; answers 404 when the secret is missing or shorter than 32 characters. |
| `apps/backend/src/officeactor/officeactor.controller.ts` | Bridge routes under `/officeactor` (see below). Excluded from Swagger. |
| `apps/backend/src/officeactor/officeactor.open.controller.ts` | Public `GET /oa-open/:id` for OfficeActor's "Social Media" button (see below). Excluded from Swagger. |
| `libraries/nestjs-libraries/src/database/prisma/officeactor/officeactor.service.ts` | Validates ids, upserts users, organizations and memberships, deactivates users, keeps OfficeActor admins in every organization. |
| `libraries/nestjs-libraries/src/database/prisma/officeactor/officeactor.repository.ts` | Prisma queries for the service, selecting only the fields it needs. |
| `libraries/nestjs-libraries/src/dtos/officeactor/officeactor.dto.ts` | Request validation and the shared `sub` pattern. |
| `.github/workflows/officeactor-image.yml` | Builds and pushes the image OfficeActor deploys on Render (see below). |
| `var/docker/officeactor-start.sh` | Start command on Render and in OfficeActor's local stack (see below). |
| `apps/frontend/src/officeactor/officeactor.theme.scss` | OfficeActor's colors over Postiz's theme (see Branding below). |
| `apps/frontend/src/officeactor/officeactor.logo.tsx` | `OfficeActorMark`, OfficeActor's oA* mark, framed on its letters. |
| `apps/frontend/src/officeactor/officeactor.title.tsx` | `OfficeActorTitle`, the inline script that renames the browser tab. |
| `OFFICEACTOR-CHANGES.md` | This file. |

## OfficeActor bridge

Server-to-server API for OfficeActor's backend; Postiz's UI does not use it.
Through the bundled nginx it is reachable at `/api/officeactor/...`.

- **Environment:** `OFFICEACTOR_BRIDGE_SECRET`, a random value of at least 32
  characters (the guard checks only the length). Unset, every bridge route
  answers 404 and does nothing.
- **Identity:** OfficeActor accounts are Postiz users with `providerName =
  GENERIC` and `providerId = <sub>`, where `<sub>` is `creator:<id>`,
  `business:<id>` or `admin:<id>` (lowercase MongoDB ObjectId). OfficeActor's
  OAuth login must return exactly the same value as `sub`, so Postiz signs these
  users in directly. They have no password; Postiz's password login and reset
  only look at `LOCAL` accounts.
- **Admins:** an `admin:` user is a Postiz super admin and a `SUPERADMIN` member of
  every organization. Both the user call and the organization call restore that,
  so whichever runs last completes it. The bridge never removes an admin from an
  organization; deactivating the user does.
- **Roles:** OfficeActor uses `ADMIN` for businesses and creators. Postiz only lets
  a member remove members of the same or a lower role, so they cannot remove the
  `SUPERADMIN` admins.
- **Ending access:** Postiz sessions do not expire, but `AuthMiddleware` rejects
  deactivated users on their next request. `DELETE /users/:sub` therefore ends
  access at once.

| Route | Body | Result |
| --- | --- | --- |
| `GET /officeactor/users/:sub` | – | `{ sub, activated, organizations }`, where `organizations` counts enabled memberships of organizations that are not deleted. 404 if unknown. OfficeActor's login checks it before signing a user in. |
| `PUT /officeactor/users/:sub` | `{ email, name }` | Creates an activated user without an organization, or updates email and name and reactivates it. 409 if another account has the email. |
| `DELETE /officeactor/users/:sub` | – | Deactivates the user, removes super-admin rights and all memberships. `{ deactivated: false }` if unknown. |
| `PUT /officeactor/organizations/:id` | `{ name }` | Creates the organization with OfficeActor's UUID, or renames it; adds all active admins. |
| `GET /officeactor/organizations/:id` | – | Name and members (`sub`, `email`, `role`, `disabled`), without deleted accounts. |
| `PUT /officeactor/organizations/:id/members/:sub` | `{ role: "SUPERADMIN" \| "ADMIN" }` | Adds or updates the membership and re-enables it. Admins always get `SUPERADMIN`. 404 if user or organization is missing. |
| `DELETE /officeactor/organizations/:id/members/:sub` | – | Removes the membership; `{ removed: false }` if there was none. 409 for admins. |

Every call can be repeated, also concurrently: identical calls racing each
other all succeed and create one row. Invalid `sub`, organization id, email,
name or role → 400; missing or wrong secret → 401. OfficeActor should still send
the calls for one `sub` one after another: `providerId` has no unique index.

## Opening an organization from OfficeActor

OfficeActor's "Social Media" button links to `<Postiz URL>/api/oa-open/<organization id>`.

- **Behaviour:** for a valid UUID, the route sets the `showorg` cookie with
  exactly the options of `/user/change-org` (domain from `FRONTEND_URL`,
  `secure`, `httpOnly` and `sameSite: none` unless `NOT_SECURED`, one year)
  and redirects to `${FRONTEND_URL}/`. An invalid id only redirects.
- **Signed out:** the cookie survives the sign-in through OfficeActor, because
  login sets only `auth`, so the user lands in the chosen organization.
- **Why public:** like `/user/change-org` it only stores a preference.
  `AuthMiddleware` ignores an id that is not one of the user's organizations and
  falls back to the first one. It needs neither the bridge secret nor a session.
- **Prefix:** `oa-open` deliberately does not start with `officeactor`, so a
  later restriction of `/api/officeactor` to OfficeActor's servers leaves the
  button working.

## Sign-in through OfficeActor

OfficeActor is the generic OAuth provider. Its login only lets through users the
bridge created that are activated and belong to at least one organization,
because Postiz registers unknown users with an organization of their own and
signs users without an organization out again.

- **`POSTIZ_OAUTH_AUTO_LOGIN=true`:** `officeactor.proxy.ts` handles every page
  request without a session, the `/auth` pages included, so no Postiz sign-in
  page renders:
  - It asks the backend for the login link (`GET /auth/oauth/GENERIC`, which
    sets `oauth_state`) and redirects there, remembering the requested path for
    ten minutes (`oa_return`, relative paths only).
  - OfficeActor returns to `/settings?code=…&state=…`; the proxy posts code and
    state with the visitor's cookies to `POST /auth/oauth/GENERIC/exists` and
    passes its `auth` cookie on in a redirect to the remembered path or `/`.
    The backend's Set-Cookie headers are appended after every
    `response.cookies` change, which would otherwise drop them.
  - Unknown users (`token` instead of `login`) and failures go to
    `POSTIZ_OAUTH_AUTH_URL?fehler=anmeldung`. A counter cookie (`oa_sign_in`,
    60 seconds) sends the fourth sign-in within a minute to `?fehler=schleife`,
    for example when Postiz signs a user without an organization out again.
  - The backend also refuses Postiz's own `POST /auth/login`, `/auth/register`,
    `/auth/forgot`, `/auth/forgot-return`, `/auth/activate` and
    `/auth/resend-activation`. To use Postiz without OfficeActor, unset the
    variable.
- **`POSTIZ_LOGOUT_URL`:** where the browser goes after logging out of Postiz.
  OfficeActor's `/abmelden` ends its own session there. Unset, Postiz goes to `/`
  as before.
- The upstream variables `POSTIZ_GENERIC_OAUTH`, `POSTIZ_OAUTH_AUTH_URL`,
  `POSTIZ_OAUTH_TOKEN_URL`, `POSTIZ_OAUTH_USERINFO_URL`, `POSTIZ_OAUTH_CLIENT_ID`,
  `POSTIZ_OAUTH_CLIENT_SECRET` and `NEXT_PUBLIC_POSTIZ_OAUTH_DISPLAY_NAME`
  configure the provider itself. Leave `POSTIZ_GENERIC_OAUTH` unset to turn it
  off: any non-empty value, even `false`, turns it on.

## Features OfficeActor manages

`OfficeActorBlockedMiddleware` answers 403 (`Das wird über OfficeActor
verwaltet.`) for these routes, whatever the user's role; the UI hides them:

- team: `POST /settings/team` (invite), `POST /settings/team/add` (super admins
  add by email), `DELETE /settings/team/:id`, `POST /user/join-org`
- impersonation: `GET` and `POST /user/impersonate`
- `POST /user/delete-account`
- with `POSTIZ_OAUTH_AUTO_LOGIN=true`: Postiz's own sign-in routes (above)

Routes that `ApiModule`'s `AuthMiddleware` covers still answer 401 without a
session. Not changed, because already off without billing or a Sentry DSN: the
Chrome extension link and the feedback button.

## Branding

Postiz looks like OfficeActor: pink `#e91e63` for buttons, active items and the
logo, Meerblau `#005aff` as the second accent (secondary buttons, selected
options, highlights, where Postiz uses magenta), and the neutrals of OfficeActor's
dark website. The light mode keeps Postiz's layout with the same accents.

- **No upstream colors are edited.** `officeactor.theme.scss` overrides the
  variables of `colors.scss` for `.dark` and `.light`, and redirects every
  hardcoded purple that Postiz uses: Tailwind classes such as `bg-[#612BD3]` by
  their escaped class name, SVG attributes and inline styles by attribute
  selectors. Its selectors start with `html:root`, so they win over Postiz's
  rules wherever they end up in the bundle.
- **Logo:** `OfficeActorMark` frames only the letters "oA" and lets the star
  overflow to the top right, so layouts center the letters. In the left menu
  they sit in the middle of the menu column and on the middle line of the top
  bar.
- **Left menu:** 80px wide instead of 64px (96px panel), so German labels such
  as "Einstellungen" fit. The theme also keeps the menu column from growing
  past that width, which moved the logo and icons to the right.
- **Browser tab:** `OfficeActorTitle`, an inline script in `<head>`, rewrites
  `document.title` while the page is parsed and after every navigation, so the
  pages keep their upstream `metadata.title`.
- **Not changed:** the font, texts that mention Postiz, emails, the chat widgets
  of the backend's MCP apps, status colors and other brands' colors (Stripe,
  Farcaster, Facebook's text-post backgrounds).

After merging an upstream release:

1. Resolve conflicts in the changed files above in favor of OfficeActor; for the
   replaced images keep OfficeActor's version.
2. In OfficeActor's repository, run `npm run test:dev`.
   `scripts/tests/postizBranding.test.js` lists purple classes, colors and
   `colors.scss` variables that the theme does not cover yet, and checks the
   changed lines above. Add what it names to `officeactor.theme.scss`; a color
   of another brand goes on the test's own list instead.
3. Look at the calendar, the post editor and the settings in both modes, with
   the browser in German.

## Deployment on Render

OfficeActor runs this fork on Render from an image built here. The Render setup
itself (Blueprint, environment) lives in OfficeActor's repository.

- **Image:** `.github/workflows/officeactor-image.yml` builds `Dockerfile.dev` for
  `linux/amd64` on every push to `main` and pushes
  `ghcr.io/officeactor/officeactor_postiz` with the tags `main` and the commit
  SHA. It passes no build argument, like OfficeActor's local build, so
  `NEXT_PUBLIC_VERSION` stays empty. The job only runs in
  `officeactor/OfficeActor_Postiz`. Render does not redeploy when the tag moves;
  a deploy is started by hand.
- **Start command:** `sh /app/var/docker/officeactor-start.sh` replaces the
  image's `CMD` and then runs the same nginx and pm2 start.
  - It unsets `PORT`. Render sets it to the port it sends public traffic to,
    which is nginx (5000), but `apps/backend/src/main.ts` reads `PORT` too and
    has to stay on 3000, where nginx expects the backend.
  - It sets `TEMPORAL_ADDRESS` to `$TEMPORAL_HOST:7233` when only
    `TEMPORAL_HOST` is given, because Render passes another service's host
    name without a port.
