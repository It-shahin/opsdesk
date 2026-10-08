// Initialize Nest's ESM packages before CommonJS plugins require them. Loading
// the throttler in the same module graph otherwise triggers a Jest import cycle.
import '@nestjs/common';
import '@nestjs/core';
