/**
 * @pain-therapy/shared: code used by the practice app and the patient zone (iteration 4, design D11). Client
 * components import the subpaths (e.g. @pain-therapy/shared/home-program) so no server module ends up in a bundle.
 */
export * from './access';
export * from './adherence';
export * from './consent-blocks';
export * from './home-program';
export * from './log-entry';
export * from './pdf-view';
export * from './program';
export * from './signing';
export * from './time';
export * from './tokens';
export { createPrismaClient } from './db';
