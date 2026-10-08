import {
  IsEmail,
  IsIn,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

// OfficeActor's login subject: account type plus MongoDB ObjectId, exactly as
// OfficeActor's OAuth userinfo returns it.
export const officeActorSubPattern = /^(creator|business|admin):[a-f0-9]{24}$/;
export const officeActorAdminPrefix = 'admin:';

export const officeActorMemberRoles = ['SUPERADMIN', 'ADMIN'] as const;
export type OfficeActorMemberRole = (typeof officeActorMemberRoles)[number];

export class OfficeActorUserDto {
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  @Matches(/\S/)
  name: string;
}

export class OfficeActorOrganizationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  @Matches(/\S/)
  name: string;
}

export class OfficeActorMemberDto {
  @IsIn(officeActorMemberRoles)
  role: OfficeActorMemberRole;
}
