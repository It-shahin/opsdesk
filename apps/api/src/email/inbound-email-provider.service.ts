import {
  Inject,
  Injectable,
} from '@nestjs/common';

import type {
  Resend,
} from 'resend';

import {
  RESEND_INBOUND_CLIENT,
} from './email.constants.js';

@Injectable()
export class InboundEmailProviderService {
  constructor(
    @Inject(
      RESEND_INBOUND_CLIENT,
    )
    private readonly resend:
      Resend,
  ) {}

  async getReceivedEmail(
    emailId: string,
  ) {
    const {
      data,
      error,
    } =
      await this.resend
        .emails
        .receiving
        .get(
          emailId,
        );

    if (
      error
    ) {
      throw new Error(
        `Failed to retrieve inbound email: ${error.name}`,
      );
    }

    if (
      !data
    ) {
      throw new Error(
        'Resend returned no inbound email',
      );
    }

    return data;
  }
}