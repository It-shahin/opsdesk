import { Injectable } from '@nestjs/common';

import { MembershipsService } from '../memberships/memberships.service.js';
import type { TenantContext } from './tenant-context.types.js';

@Injectable()
export class TenantContextService {
  constructor(
    private readonly membershipsService:
      MembershipsService,
  ) {}

  async resolve(
    userId: string,
    organizationId: string,
  ): Promise<TenantContext | null> {
    const membership =
      await this.membershipsService
        .findForUserAndOrganization(
          userId,
          organizationId,
        );

    if (!membership) {
      return null;
    }

    return {
      userId,
      organizationId:
        membership.organizationId,
      membershipId: membership.id,
      role: membership.role,
    };
  }
}