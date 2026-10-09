import { Controller, Get, Param, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Response } from 'express';
import { isUUID } from 'class-validator';
import { getCookieUrlFromDomain } from '@gitroom/helpers/subdomain/subdomain.management';

// OfficeActor's "Social Media" button opens Postiz in the business's
// organization: this sets the same `showorg` cookie as /user/change-org and
// continues to the app. A signed-out visitor keeps the cookie through the
// sign-in through OfficeActor, which never touches it. Public on purpose, like
// change-org it only stores a preference: AuthMiddleware ignores an id that is
// not one of the user's organizations and falls back to the first one.
@ApiExcludeController()
@Controller('/oa-open')
export class OfficeActorOpenController {
  @Get('/:id')
  openOrganization(@Param('id') id: string, @Res() response: Response) {
    if (isUUID(id)) {
      response.cookie('showorg', id, {
        domain: getCookieUrlFromDomain(process.env.FRONTEND_URL!),
        ...(!process.env.NOT_SECURED
          ? {
              secure: true,
              httpOnly: true,
              sameSite: 'none',
            }
          : {}),
        expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365),
      });
    }
    response.setHeader('Cache-Control', 'no-store');
    return response.redirect(302, `${process.env.FRONTEND_URL}/`);
  }
}
