import { Module } from '@nestjs/common';
import { OfficeActorController } from '@gitroom/backend/officeactor/officeactor.controller';
import { OfficeActorBridgeGuard } from '@gitroom/backend/officeactor/officeactor.guard';
import { OfficeActorRepository } from '@gitroom/nestjs-libraries/database/prisma/officeactor/officeactor.repository';
import { OfficeActorService } from '@gitroom/nestjs-libraries/database/prisma/officeactor/officeactor.service';

// Self-contained so the fork touches only one upstream file (app.module.ts).
// It stays out of ApiModule's AuthMiddleware; OfficeActorBridgeGuard protects it.
// Like ApiModule and PublicApiModule, it mounts nothing in MCP_ONLY mode.
@Module({
  controllers: process.env.MCP_ONLY ? [] : [OfficeActorController],
  providers: [OfficeActorBridgeGuard, OfficeActorRepository, OfficeActorService],
})
export class OfficeActorModule {}
