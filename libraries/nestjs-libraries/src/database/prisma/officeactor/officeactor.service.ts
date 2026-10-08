import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Provider, Role } from '@prisma/client';
import { isUUID } from 'class-validator';
import { OfficeActorRepository } from '@gitroom/nestjs-libraries/database/prisma/officeactor/officeactor.repository';
import {
  officeActorAdminPrefix,
  OfficeActorMemberRole,
  OfficeActorOrganizationDto,
  officeActorSubPattern,
  OfficeActorUserDto,
} from '@gitroom/nestjs-libraries/dtos/officeactor/officeactor.dto';

const isAdminSub = (sub: string) => sub.startsWith(officeActorAdminPrefix);

// Prisma reports a unique-constraint violation as P2002, for example when two
// identical requests race to create the same row.
const isUniqueViolation = (err: unknown) =>
  (err as { code?: string })?.code === 'P2002';

const checkSub = (sub: string) => {
  if (!officeActorSubPattern.test(sub)) {
    throw new BadRequestException('Invalid sub');
  }
};

const checkOrganizationId = (id: string) => {
  if (!isUUID(id)) {
    throw new BadRequestException('Invalid organization id');
  }
};

// Every call can be repeated safely, also concurrently: OfficeActor retries
// after failures. OfficeActor admins are Postiz super admins and SUPERADMIN
// members of every organization; the user and the organization calls both
// restore that, so whichever runs last completes it.
@Injectable()
export class OfficeActorService {
  constructor(private _officeActorRepository: OfficeActorRepository) {}

  async upsertUser(sub: string, body: OfficeActorUserDto) {
    checkSub(sub);
    const email = body.email.trim().toLowerCase();
    const name = body.name.trim();
    const isAdmin = isAdminSub(sub);
    let user: { id: string } | null =
      await this._officeActorRepository.getUserBySub(sub);

    const withEmail = await this._officeActorRepository.getOtherUserWithEmail(
      email,
      user?.id
    );
    if (withEmail) {
      if (withEmail.providerId !== sub) {
        throw new ConflictException('Email belongs to another account');
      }
      // An identical concurrent call created this user after our lookup.
      user = user || { id: withEmail.id };
    }

    let created = false;
    if (!user) {
      try {
        user = await this._officeActorRepository.createUser(
          sub,
          email,
          name,
          isAdmin
        );
        created = true;
      } catch (err) {
        if (!isUniqueViolation(err)) {
          throw err;
        }
        // An identical concurrent call created the user first; update below.
        user = await this._officeActorRepository.getUserBySub(sub);
        if (!user) {
          throw new ConflictException('Email belongs to another account');
        }
      }
    }

    if (!created) {
      try {
        await this._officeActorRepository.updateUser(
          user.id,
          email,
          name,
          isAdmin
        );
      } catch (err) {
        if (isUniqueViolation(err)) {
          throw new ConflictException('Email belongs to another account');
        }
        throw err;
      }
    }

    if (isAdmin) {
      const organizations = await this._officeActorRepository.getOrganizations();
      await this._officeActorRepository.addAdminToOrganizations(
        user.id,
        organizations.map((organization) => organization.id)
      );
    }

    return { id: user.id, created };
  }

  // OfficeActor's login asks this before it signs a user in: Postiz signs
  // users out again when they are deactivated or belong to no organization.
  async getUser(sub: string) {
    checkSub(sub);
    const user = await this._officeActorRepository.getUserStatusBySub(sub);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const organizations =
      await this._officeActorRepository.countActiveMemberships(user.id);
    return { sub, activated: user.activated, organizations };
  }

  // Ends access at once, also for sessions that are still signed in: Postiz
  // sessions do not expire, but AuthMiddleware rejects deactivated users.
  // A later PUT /users/:sub activates the account again; memberships other
  // than an admin's must then be added again.
  async deactivateUser(sub: string) {
    checkSub(sub);
    const user = await this._officeActorRepository.getUserBySub(sub);
    if (!user) {
      return { deactivated: false };
    }

    await this._officeActorRepository.deactivateUser(user.id);
    await this._officeActorRepository.removeAllMemberships(user.id);
    return { deactivated: true };
  }

  async upsertOrganization(id: string, body: OfficeActorOrganizationDto) {
    checkOrganizationId(id);
    const name = body.name.trim();
    const existing = await this._officeActorRepository.getOrganizationById(id);
    if (existing?.deletedAt) {
      throw new ConflictException('Organization was deleted');
    }

    let created = false;
    if (!existing) {
      try {
        await this._officeActorRepository.createOrganization(id, name);
        created = true;
      } catch (err) {
        // An identical concurrent call created it first; rename below.
        if (!isUniqueViolation(err)) {
          throw err;
        }
      }
    }
    if (!created) {
      await this._officeActorRepository.renameOrganization(id, name);
    }

    const admins = await this._officeActorRepository.getAdminUsers();
    await this._officeActorRepository.addAdminsToOrganization(
      id,
      admins.map((admin) => admin.id)
    );

    return { id, created };
  }

  async getOrganization(id: string) {
    checkOrganizationId(id);
    const organization =
      await this._officeActorRepository.getOrganizationWithMembers(id);
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    return {
      id: organization.id,
      name: organization.name,
      members: organization.users.map((member) => ({
        sub:
          member.user.providerName === Provider.GENERIC
            ? member.user.providerId
            : null,
        email: member.user.email,
        role: member.role,
        disabled: member.disabled,
      })),
    };
  }

  async addMember(id: string, sub: string, role: OfficeActorMemberRole) {
    checkOrganizationId(id);
    checkSub(sub);
    const [user, organization] = await Promise.all([
      this._officeActorRepository.getUserBySub(sub),
      this._officeActorRepository.getOrganizationById(id),
    ]);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (!organization || organization.deletedAt) {
      throw new NotFoundException('Organization not found');
    }

    const memberRole = isAdminSub(sub) ? Role.SUPERADMIN : Role[role];
    await this._officeActorRepository.setMembership(user.id, id, memberRole);
    return { role: memberRole };
  }

  async removeMember(id: string, sub: string) {
    checkOrganizationId(id);
    checkSub(sub);
    if (isAdminSub(sub)) {
      throw new ConflictException(
        'OfficeActor admins stay in every organization; deactivate the user instead'
      );
    }

    const user = await this._officeActorRepository.getUserBySub(sub);
    if (!user) {
      return { removed: false };
    }

    const { count } = await this._officeActorRepository.removeMembership(
      user.id,
      id
    );
    return { removed: count > 0 };
  }
}
