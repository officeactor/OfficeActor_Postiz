# OfficeActor changes

This fork of [Postiz](https://github.com/gitroomhq/postiz-app) adds what
[OfficeActor](https://officeactor.de) needs to run Postiz for its customers.
This file lists every change against the original project, so upstream releases
can be merged with little effort. Keep it current with every change.

Rules: configure through environment variables before changing code, add new
files instead of rewriting existing ones, and hide features instead of deleting
files.

## Changed upstream files

| File | Change | Reason |
| --- | --- | --- |
| `apps/backend/src/app.module.ts` | Imports `OfficeActorModule` (one import line, one entry in `imports`). | Mounts the OfficeActor bridge without touching `ApiModule`'s controller lists or its `AuthMiddleware`. |
| `apps/backend/src/services/auth/providers/oauth.provider.ts` | `getUser` rejects a userinfo response without a non-empty `sub` and `email`. | Users are looked up by `providerId`; an undefined `sub` drops that filter and would sign in an arbitrary `GENERIC` user. |
| `apps/frontend/src/app/(app)/auth/login/page.tsx` | Renders `OauthAutoLogin` when `POSTIZ_OAUTH_AUTO_LOGIN` is `true`, unless `?manual=1`. | Sign-in goes through OfficeActor without an extra click. |
| `apps/frontend/src/app/(app)/auth/page.tsx` | Same as the login page, except for the OAuth callback (`provider` or `code` in the URL). | Signed-out visitors land on `/auth`, not `/auth/login`. |
| `libraries/react-shared-libraries/src/helpers/variable.context.tsx` | Optional `logoutUrl` variable. | Passes `POSTIZ_LOGOUT_URL` to the logout button. |
| `apps/frontend/src/app/(app)/layout.tsx` | Passes `POSTIZ_LOGOUT_URL` as `logoutUrl`. | As above. |
| `apps/frontend/src/components/layout/logout.component.tsx` | After logging out, goes to `logoutUrl` when set, otherwise `/` as before. | Logging out of Postiz also ends the OfficeActor session; otherwise automatic sign-in would log the user straight back in. |

## Added files

| File | Purpose |
| --- | --- |
| `apps/backend/src/officeactor/officeactor.module.ts` | Registers the bridge controller, guard, service and repository; mounts no controller in `MCP_ONLY` mode, like `ApiModule`. |
| `apps/backend/src/officeactor/officeactor.guard.ts` | Requires `Authorization: Bearer <OFFICEACTOR_BRIDGE_SECRET>`; answers 404 when the secret is missing or shorter than 32 characters. |
| `apps/backend/src/officeactor/officeactor.controller.ts` | Bridge routes under `/officeactor` (see below). Excluded from Swagger. |
| `libraries/nestjs-libraries/src/database/prisma/officeactor/officeactor.service.ts` | Validates ids, upserts users, organizations and memberships, deactivates users, keeps OfficeActor admins in every organization. |
| `libraries/nestjs-libraries/src/database/prisma/officeactor/officeactor.repository.ts` | Prisma queries for the service, selecting only the fields it needs. |
| `libraries/nestjs-libraries/src/dtos/officeactor/officeactor.dto.ts` | Request validation and the shared `sub` pattern. |
| `apps/frontend/src/components/auth/oauth.auto.login.tsx` | Starts the generic OAuth sign-in on page load; after two redirects within 60 seconds it shows the sign-in button and a link to the password login instead. |
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

## Sign-in through OfficeActor

OfficeActor is the generic OAuth provider. Its login only lets through users the
bridge created that are activated and belong to at least one organization,
because Postiz registers unknown users with an organization of their own and
signs users without an organization out again.

- **`POSTIZ_OAUTH_AUTO_LOGIN=true`:** `/auth` and `/auth/login` start the OAuth
  sign-in at once. `/auth/login?manual=1` shows the normal login form, for
  example for a password account in an emergency.
- **`POSTIZ_LOGOUT_URL`:** where the browser goes after logging out of Postiz.
  OfficeActor's `/abmelden` ends its own session there. Unset, Postiz goes to `/`
  as before.
- The upstream variables `POSTIZ_GENERIC_OAUTH`, `POSTIZ_OAUTH_AUTH_URL`,
  `POSTIZ_OAUTH_TOKEN_URL`, `POSTIZ_OAUTH_USERINFO_URL`, `POSTIZ_OAUTH_CLIENT_ID`,
  `POSTIZ_OAUTH_CLIENT_SECRET` and `NEXT_PUBLIC_POSTIZ_OAUTH_DISPLAY_NAME`
  configure the provider itself. Leave `POSTIZ_GENERIC_OAUTH` unset to turn it
  off: any non-empty value, even `false`, turns it on.
