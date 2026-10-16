import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Sign-in through OfficeActor without a Postiz page in between
// (POSTIZ_OAUTH_AUTO_LOGIN). A signed-out visitor goes straight to
// OfficeActor's authorize page, and the code OfficeActor returns to
// `/settings` is redeemed here on the server, so the browser only ever shows
// OfficeActor's loading bar and then the Postiz app. Both steps reuse the
// backend's own routes: GET /auth/oauth/GENERIC (link and state cookie) and
// POST /auth/oauth/GENERIC/exists (sets the `auth` cookie).

const returnCookie = 'oa_return';
const attemptsCookie = 'oa_sign_in';
const attemptWindowSeconds = 60;
// Postiz signs a user without an organization straight out again; when that
// happens repeatedly the visitor gets OfficeActor's error page, not a loop.
const maxAttempts = 3;

const cookieOptions = (maxAge: number) => ({
  path: '/',
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: !process.env.NOT_SECURED,
  maxAge,
});

const backend = (path: string, init: RequestInit) =>
  fetch(`${process.env.BACKEND_INTERNAL_URL}${path}`, {
    ...init,
    cache: 'no-store',
    redirect: 'manual',
  });

// `backendCookies` are the backend's raw Set-Cookie headers. They are appended
// last: every change through `response.cookies` rewrites the Set-Cookie
// headers from its own list and would drop them.
const redirect = (
  target: string | URL,
  cookies: (response: NextResponse) => void = () => undefined,
  backendCookies: string[] = []
) => {
  const response = NextResponse.redirect(target, 302);
  response.headers.set('Cache-Control', 'no-store');
  cookies(response);
  for (const cookie of backendCookies) {
    response.headers.append('set-cookie', cookie);
  }
  return response;
};

// OfficeActor's sign-in page shows a German message for `fehler`.
const failure = (reason: 'anmeldung' | 'schleife') => {
  const target = new URL(process.env.POSTIZ_OAUTH_AUTH_URL!);
  target.search = '';
  target.searchParams.set('fehler', reason);
  return redirect(target, (response) => {
    response.cookies.delete(returnCookie);
    response.cookies.delete(attemptsCookie);
  });
};

// Only paths on this host, never `//other.host` or a full URL.
const safeReturnPath = (value?: string) =>
  value && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\')
    ? value
    : '/';

const redeemCode = async (request: NextRequest) => {
  const { searchParams } = request.nextUrl;
  try {
    const response = await backend('/auth/oauth/GENERIC/exists', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: request.headers.get('cookie') || '',
      },
      body: JSON.stringify({
        code: searchParams.get('code'),
        state: searchParams.get('state') || '',
      }),
    });
    const body = response.ok ? await response.json() : undefined;
    // `token` alone means Postiz does not know the user and would register it.
    if (!body?.login) {
      return failure('anmeldung');
    }
    const target = new URL(
      safeReturnPath(request.cookies.get(returnCookie)?.value),
      request.nextUrl.href
    );
    return redirect(
      target,
      (signedIn) => signedIn.cookies.delete(returnCookie),
      response.headers.getSetCookie()
    );
  } catch (error) {
    console.error('OfficeActor sign-in: redeeming the code failed', error);
    return failure('anmeldung');
  }
};

const startSignIn = async (request: NextRequest) => {
  const attempts = Number(request.cookies.get(attemptsCookie)?.value) || 0;
  if (attempts >= maxAttempts) {
    return failure('schleife');
  }
  try {
    const response = await backend('/auth/oauth/GENERIC', { method: 'GET' });
    const link = response.ok ? (await response.text()).trim() : '';
    if (!/^https?:\/\//.test(link)) {
      throw new Error(`Login link request answered ${response.status}`);
    }
    const { pathname, search } = request.nextUrl;
    return redirect(
      link,
      (toOfficeActor) => {
        toOfficeActor.cookies.set(
          attemptsCookie,
          String(attempts + 1),
          cookieOptions(attemptWindowSeconds)
        );
        if (!pathname.startsWith('/auth') && pathname !== '/') {
          toOfficeActor.cookies.set(
            returnCookie,
            pathname + search,
            cookieOptions(10 * 60)
          );
        }
      },
      response.headers.getSetCookie()
    );
  } catch (error) {
    console.error('OfficeActor sign-in: requesting the login link failed', error);
    return failure('anmeldung');
  }
};

export const officeActorSignIn = async (
  request: NextRequest,
  signedIn: boolean
): Promise<NextResponse | undefined> => {
  if (process.env.POSTIZ_OAUTH_AUTO_LOGIN !== 'true' || signedIn) {
    return undefined;
  }
  const { pathname, searchParams } = request.nextUrl;
  // OfficeActor returns to `${FRONTEND_URL}/settings`, Postiz's redirect URI.
  if (pathname === '/settings' && searchParams.get('code')) {
    return redeemCode(request);
  }
  return startSignIn(request);
};
