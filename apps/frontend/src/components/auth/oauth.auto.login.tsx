'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { OauthProvider } from '@gitroom/frontend/components/auth/providers/oauth.provider';

// Sends signed-out visitors straight to the generic OAuth provider
// (POSTIZ_OAUTH_AUTO_LOGIN). Postiz signs a user out again when the provider
// lets through an account without an organization, so after a few redirects
// in a short time the page stops and offers the button instead of looping.
const attemptsKey = 'postiz-oauth-auto-login';
const attemptWindow = 60_000;
const maxAttempts = 2;

const recordAttempt = () => {
  try {
    const now = Date.now();
    const recent = (
      JSON.parse(sessionStorage.getItem(attemptsKey) || '[]') as number[]
    ).filter((time) => now - time < attemptWindow);
    if (recent.length >= maxAttempts) {
      return false;
    }
    sessionStorage.setItem(attemptsKey, JSON.stringify([...recent, now]));
    return true;
  } catch {
    return true;
  }
};

export const OauthAutoLogin = () => {
  const fetch = useFetch();
  const t = useT();
  const [manual, setManual] = useState(false);

  useEffect(() => {
    if (!recordAttempt()) {
      setManual(true);
      return;
    }
    (async () => {
      try {
        const response = await fetch('/auth/oauth/GENERIC');
        if (!response.ok) {
          throw new Error(
            `Login link request failed with status ${response.status}`
          );
        }
        window.location.href = await response.text();
      } catch (error) {
        console.error('Failed to get generic oauth login link:', error);
        setManual(true);
      }
    })();
  }, []);

  if (!manual) {
    return (
      <div className="text-center">
        {t('redirecting_to_sign_in', 'Redirecting to sign in…')}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[24px]">
      <h1 className="text-[40px] font-[500] -tracking-[0.8px] text-start">
        {t('sign_in', 'Sign In')}
      </h1>
      <OauthProvider />
      <Link
        className="underline hover:font-bold text-center"
        href="/auth/login?manual=1"
      >
        {t('login_instead', 'Login instead')}
      </Link>
    </div>
  );
};
