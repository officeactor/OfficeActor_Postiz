import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { Provider, Role } from '@prisma/client';
import { AuthService } from '@gitroom/helpers/auth/auth.service';
import { makeSecureId } from '@gitroom/nestjs-libraries/services/make.secure.id';
import { officeActorAdminPrefix } from '@gitroom/nestjs-libraries/dtos/officeactor/officeactor.dto';

// Accounts that OfficeActor manages sign in through the generic OAuth provider;
// providerId holds OfficeActor's subject ("creator:<id>", "business:<id>",
// "admin:<id>"), the value its login returns as `sub`.
@Injectable()
export class OfficeActorRepository {
  constructor(
    private _user: PrismaRepository<'user'>,
    private _organization: PrismaRepository<'organization'>,
    private _userOrg: PrismaRepository<'userOrganization'>
  ) {}

  // providerId has no unique index (LOCAL users store ''), so always pick the
  // oldest row should a race ever have created two.
  getUserBySub(sub: string) {
    return this._user.model.user.findFirst({
      where: {
        providerName: Provider.GENERIC,
        providerId: sub,
        deletedAt: null,
      },
      orderBy: {
        createdAt: 'asc',
      },
      select: {
        id: true,
      },
    });
  }

  getUserStatusBySub(sub: string) {
    return this._user.model.user.findFirst({
      where: {
        providerName: Provider.GENERIC,
        providerId: sub,
        deletedAt: null,
      },
      orderBy: {
        createdAt: 'asc',
      },
      select: {
        id: true,
        activated: true,
      },
    });
  }

  // The organizations AuthMiddleware lets the user work in: enabled
  // memberships of organizations that are not deleted.
  countActiveMemberships(userId: string) {
    return this._userOrg.model.userOrganization.count({
      where: {
        userId,
        disabled: false,
        organization: {
          deletedAt: null,
        },
      },
    });
  }

  // Includes deleted rows: the unique (email, providerName) index does too.
  getOtherUserWithEmail(email: string, exceptUserId?: string) {
    return this._user.model.user.findFirst({
      where: {
        providerName: Provider.GENERIC,
        email: {
          equals: email,
          mode: 'insensitive',
        },
        ...(exceptUserId ? { NOT: { id: exceptUserId } } : {}),
      },
      select: {
        id: true,
        providerId: true,
      },
    });
  }

  createUser(sub: string, email: string, name: string, isSuperAdmin: boolean) {
    return this._user.model.user.create({
      data: {
        providerName: Provider.GENERIC,
        providerId: sub,
        email,
        name,
        isSuperAdmin,
        activated: true,
        timezone: 0,
      },
      select: {
        id: true,
      },
    });
  }

  updateUser(id: string, email: string, name: string, isSuperAdmin: boolean) {
    return this._user.model.user.update({
      where: {
        id,
      },
      data: {
        email,
        name,
        isSuperAdmin,
        activated: true,
      },
      select: {
        id: true,
      },
    });
  }

  // AuthMiddleware rejects users with activated: false on their next request,
  // which also ends sessions whose JWT is still valid.
  deactivateUser(id: string) {
    return this._user.model.user.update({
      where: {
        id,
      },
      data: {
        activated: false,
        isSuperAdmin: false,
      },
      select: {
        id: true,
      },
    });
  }

  getAdminUsers() {
    return this._user.model.user.findMany({
      where: {
        providerName: Provider.GENERIC,
        providerId: {
          startsWith: officeActorAdminPrefix,
        },
        activated: true,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });
  }

  getOrganizationById(id: string) {
    return this._organization.model.organization.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        deletedAt: true,
      },
    });
  }

  getOrganizations() {
    return this._organization.model.organization.findMany({
      where: {
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });
  }

  createOrganization(id: string, name: string) {
    return this._organization.model.organization.create({
      data: {
        id,
        name,
        apiKey: AuthService.fixedEncryption(makeSecureId(20)),
      },
      select: {
        id: true,
      },
    });
  }

  renameOrganization(id: string, name: string) {
    return this._organization.model.organization.update({
      where: {
        id,
      },
      data: {
        name,
      },
      select: {
        id: true,
      },
    });
  }

  getOrganizationWithMembers(id: string) {
    return this._organization.model.organization.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        users: {
          where: {
            user: {
              deletedAt: null,
            },
          },
          select: {
            role: true,
            disabled: true,
            user: {
              select: {
                providerName: true,
                providerId: true,
                email: true,
              },
            },
          },
        },
      },
    });
  }

  setMembership(userId: string, organizationId: string, role: Role) {
    return this._userOrg.model.userOrganization.upsert({
      where: {
        userId_organizationId: {
          userId,
          organizationId,
        },
      },
      create: {
        userId,
        organizationId,
        role,
      },
      update: {
        role,
        disabled: false,
      },
      select: {
        id: true,
      },
    });
  }

  // One admin into many organizations, as SUPERADMIN and enabled.
  async addAdminToOrganizations(userId: string, organizationIds: string[]) {
    if (organizationIds.length === 0) {
      return;
    }
    await this._userOrg.model.userOrganization.createMany({
      data: organizationIds.map((organizationId) => ({
        userId,
        organizationId,
        role: Role.SUPERADMIN,
      })),
      skipDuplicates: true,
    });
    await this._userOrg.model.userOrganization.updateMany({
      where: {
        userId,
        organizationId: {
          in: organizationIds,
        },
      },
      data: {
        role: Role.SUPERADMIN,
        disabled: false,
      },
    });
  }

  // Many admins into one organization, as SUPERADMIN and enabled.
  async addAdminsToOrganization(organizationId: string, userIds: string[]) {
    if (userIds.length === 0) {
      return;
    }
    await this._userOrg.model.userOrganization.createMany({
      data: userIds.map((userId) => ({
        userId,
        organizationId,
        role: Role.SUPERADMIN,
      })),
      skipDuplicates: true,
    });
    await this._userOrg.model.userOrganization.updateMany({
      where: {
        organizationId,
        userId: {
          in: userIds,
        },
      },
      data: {
        role: Role.SUPERADMIN,
        disabled: false,
      },
    });
  }

  removeMembership(userId: string, organizationId: string) {
    return this._userOrg.model.userOrganization.deleteMany({
      where: {
        userId,
        organizationId,
      },
    });
  }

  removeAllMemberships(userId: string) {
    return this._userOrg.model.userOrganization.deleteMany({
      where: {
        userId,
      },
    });
  }
}
