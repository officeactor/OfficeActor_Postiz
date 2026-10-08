export const dynamic = 'force-dynamic';
import { Login } from '@gitroom/frontend/components/auth/login';
import { OauthAutoLogin } from '@gitroom/frontend/components/auth/oauth.auto.login';
import { Metadata } from 'next';
import { isGeneralServerSide } from '@gitroom/helpers/utils/is.general.server.side';
export const metadata: Metadata = {
  title: `${isGeneralServerSide() ? 'Postiz' : 'Gitroom'} Login`,
  description: '',
};
export default async function Auth(params: {
  searchParams: Promise<{ manual?: string }>;
}) {
  if (
    process.env.POSTIZ_OAUTH_AUTO_LOGIN === 'true' &&
    (await params?.searchParams)?.manual !== '1'
  ) {
    return <OauthAutoLogin />;
  }
  return <Login />;
}
