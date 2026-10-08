import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { OfficeActorService } from '@gitroom/nestjs-libraries/database/prisma/officeactor/officeactor.service';
import {
  OfficeActorMemberDto,
  OfficeActorOrganizationDto,
  OfficeActorUserDto,
} from '@gitroom/nestjs-libraries/dtos/officeactor/officeactor.dto';
import { OfficeActorBridgeGuard } from '@gitroom/backend/officeactor/officeactor.guard';

// Bridge for OfficeActor's backend; not part of the Postiz UI or public API.
// Organization ids are chosen by OfficeActor, so repeated calls never create
// duplicates. The service validates `sub` and the organization id.
@ApiExcludeController()
@UseGuards(OfficeActorBridgeGuard)
@Controller('/officeactor')
export class OfficeActorController {
  constructor(private _officeActorService: OfficeActorService) {}

  @Put('/users/:sub')
  upsertUser(@Param('sub') sub: string, @Body() body: OfficeActorUserDto) {
    return this._officeActorService.upsertUser(sub, body);
  }

  @Delete('/users/:sub')
  deactivateUser(@Param('sub') sub: string) {
    return this._officeActorService.deactivateUser(sub);
  }

  @Put('/organizations/:id')
  upsertOrganization(
    @Param('id') id: string,
    @Body() body: OfficeActorOrganizationDto
  ) {
    return this._officeActorService.upsertOrganization(id, body);
  }

  @Get('/organizations/:id')
  getOrganization(@Param('id') id: string) {
    return this._officeActorService.getOrganization(id);
  }

  @Put('/organizations/:id/members/:sub')
  addMember(
    @Param('id') id: string,
    @Param('sub') sub: string,
    @Body() body: OfficeActorMemberDto
  ) {
    return this._officeActorService.addMember(id, sub, body.role);
  }

  @Delete('/organizations/:id/members/:sub')
  removeMember(@Param('id') id: string, @Param('sub') sub: string) {
    return this._officeActorService.removeMember(id, sub);
  }
}
