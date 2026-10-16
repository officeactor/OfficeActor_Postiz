import { Injectable, NestMiddleware, RequestMethod } from '@nestjs/common';
import { RouteInfo } from '@nestjs/common/interfaces';
import { NextFunction, Request, Response } from 'express';

// Accounts, team membership and sign-in belong to OfficeActor. Its projects
// decide who is a member of which organization, and every user signs in
// through it. The frontend hides these actions; this refuses them on the
// server as well, so they cannot be called directly either.
const managedRoutes: RouteInfo[] = [
  // Team: invitations, adding by email (super admins), removing, joining by link
  { path: 'settings/team', method: RequestMethod.POST },
  { path: 'settings/team/add', method: RequestMethod.POST },
  { path: 'settings/team/:id', method: RequestMethod.DELETE },
  { path: 'user/join-org', method: RequestMethod.POST },
  // Acting as another user
  { path: 'user/impersonate', method: RequestMethod.GET },
  { path: 'user/impersonate', method: RequestMethod.POST },
  // Deleting the account would detach it from its OfficeActor identity
  { path: 'user/delete-account', method: RequestMethod.POST },
];

// Postiz's own accounts: with sign-in through OfficeActor nobody has a Postiz
// password, and registration would create users OfficeActor does not know.
const postizSignIn: RouteInfo[] = [
  'auth/login',
  'auth/register',
  'auth/forgot',
  'auth/forgot-return',
  'auth/activate',
  'auth/resend-activation',
].map((path) => ({ path, method: RequestMethod.POST }));

export const officeActorBlockedRoutes = (): RouteInfo[] => [
  ...managedRoutes,
  ...(process.env.POSTIZ_OAUTH_AUTO_LOGIN === 'true' ? postizSignIn : []),
];

@Injectable()
export class OfficeActorBlockedMiddleware implements NestMiddleware {
  use(_request: Request, response: Response, _next: NextFunction) {
    response.status(403).json({
      statusCode: 403,
      message: 'Das wird über OfficeActor verwaltet.',
    });
  }
}
