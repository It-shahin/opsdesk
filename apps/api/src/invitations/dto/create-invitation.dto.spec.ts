import { describe, expect, it } from '@jest/globals';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateInvitationDto } from './create-invitation.dto.js';

// Valid email syntax on both sides of the explicit length boundary.
function emailOfLength(length: number) {
  return `${'a'.repeat(64)}@${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(length - 193)}`;
}

describe('CreateInvitationDto', () => {
  it('normalizes email before validating', async () => {
    const dto = plainToInstance(CreateInvitationDto, {
      email: '  Person@Example.test  ',
      role: 'AGENT',
    });
    expect(dto.email).toBe('person@example.test');
    expect(await validate(dto)).toEqual([]);
  });

  it('accepts an email at 254 characters', async () => {
    const email = emailOfLength(254);
    expect(email.length).toBe(254);
    expect(
      await validate(
        plainToInstance(CreateInvitationDto, { email, role: 'AGENT' }),
      ),
    ).toEqual([]);
  });

  it('rejects email exceeding the explicit cap', async () => {
    const errors = await validate(
      plainToInstance(CreateInvitationDto, {
        email: emailOfLength(255),
        role: 'AGENT',
      }),
    );
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          property: 'email',
          constraints: expect.objectContaining({
            maxLength: expect.any(String),
          }),
        }),
      ]),
    );
  });
});
