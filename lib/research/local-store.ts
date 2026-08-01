/**
 * @deprecated Phase 1 helper. Prefer `@/lib/research/services` and
 * `@/lib/research/local-repository` (local-dev only).
 */
export {
  clearLocalResearchLibraryForTests as clearResearchLibraryForTests,
  createLocalResearchRepository,
  hashLocalBuffer as hashBuffer,
  readResearchLibrary,
} from "@/lib/research/local-repository";
