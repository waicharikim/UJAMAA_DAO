/**
 * @file src/modules/auth/index.ts
 * @description
 * Auth Module - Public API
 * 
 * Exports all services, types, and routes for the authentication module.
 * 
 * Version: 2.1 — January 2026
 */

// Services
export { authService } from "./services/auth.service.js";
export { walletService } from "./services/wallet.service.js";
export { sessionService } from "./services/session.service.js";
export { tokenService } from "./services/token.service.js";

// Types
export * from "./types.js";

// Validators
export * as authValidators from "./validators/auth.validators.js";

// Routes
export { default as authRoutes } from "./routes/auth.routes.js";

/**
 * USAGE IN MAIN APP:
 * 
 * import { authRoutes } from './modules/auth/index.js';
 * 
 * app.use('/auth', authRoutes);
 */