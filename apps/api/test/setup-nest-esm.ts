import { jest } from '@jest/globals';
import * as common from '@nestjs/common';
import * as core from '@nestjs/core';

// Node 22 can require Nest's ESM packages, but Jest's VM cannot. Give CommonJS
// plugins (such as @nestjs/throttler) the real, already imported namespaces.
// ESM imports still load the original modules; no Nest behavior is replaced.
jest.mock('@nestjs/common', () => common);
jest.mock('@nestjs/core', () => core);
