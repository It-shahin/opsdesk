import {
  apiServerFetch,
} from './server';

export interface CurrentUser {
  id:
    string;

  email:
    string;

  name:
    string | null;

  avatarUrl:
    string | null;

  createdAt:
    string;

  updatedAt:
    string;
}

export function getCurrentUser() {
  return apiServerFetch<
    CurrentUser
  >(
    '/v1/me',
  );
}