/**
 * Thin re-exports for the protected process API route.
 */
export {
  advanceEpubJob,
  claimNextEpubJob,
} from "@/lib/research/epub/runner";
export { logEpubProcess as logEpubProcessSafe } from "@/lib/research/epub/safe-log";
