import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, timingSafeEqual } from 'crypto';
import { Request } from 'express';

const minimumSecretLength = 32;

const digest = (value: string) => createHash('sha256').update(value).digest();

// Server-to-server only: OfficeActor's backend sends the shared secret as a
// bearer token. Without a configured secret every bridge route answers 404 and
// does nothing. The length check cannot judge entropy: use a random secret.
@Injectable()
export class OfficeActorBridgeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const secret = process.env.OFFICEACTOR_BRIDGE_SECRET || '';
    if (secret.length < minimumSecretLength) {
      throw new NotFoundException();
    }

    const header =
      context.switchToHttp().getRequest<Request>().headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    // Comparing fixed-length digests keeps the comparison constant-time and
    // does not reveal the secret's length.
    if (!token || !timingSafeEqual(digest(token), digest(secret))) {
      throw new UnauthorizedException();
    }

    return true;
  }
}
