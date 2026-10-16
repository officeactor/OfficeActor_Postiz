import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { OfficeActorController } from '@gitroom/backend/officeactor/officeactor.controller';
import { OfficeActorOpenController } from '@gitroom/backend/officeactor/officeactor.open.controller';
import { OfficeActorBridgeGuard } from '@gitroom/backend/officeactor/officeactor.guard';
import {
  OfficeActorBlockedMiddleware,
  officeActorBlockedRoutes,
} from '@gitroom/backend/officeactor/officeactor.blocked.middleware';
import { OfficeActorRepository } from '@gitroom/nestjs-libraries/database/prisma/officeactor/officeactor.repository';
import { OfficeActorService } from '@gitroom/nestjs-libraries/database/prisma/officeactor/officeactor.service';

// Self-contained so the fork touches only one upstream file (app.module.ts).
// It stays out of ApiModule's AuthMiddleware; OfficeActorBridgeGuard protects
// the bridge, while the public OfficeActorOpenController only sets a cookie.
// OfficeActorBlockedMiddleware refuses upstream routes for actions OfficeActor
// manages, without changing their controllers.
// Like ApiModule and PublicApiModule, it mounts nothing in MCP_ONLY mode.
@Module({
  controllers: process.env.MCP_ONLY ? [] : [OfficeActorController, OfficeActorOpenController],
  providers: [OfficeActorBridgeGuard, OfficeActorRepository, OfficeActorService],
})
export class OfficeActorModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    if (process.env.MCP_ONLY) {
      return;
    }
    consumer
      .apply(OfficeActorBlockedMiddleware)
      .forRoutes(...officeActorBlockedRoutes());
  }
}
