/**
 * EPUB processing entrypoints — durable staged runner.
 * Kept as a thin facade so existing imports continue to work.
 */
export {
  queueEpubProcessing,
  setEpubProcessingSourcePatcher,
  setEpubProcessingConcurrency,
  waitForEpubProcessingIdle,
  getEpubCoverageExtras,
  enqueueEpubJob,
  claimNextEpubJob,
  advanceEpubJob,
  runEpubJobToCompletion,
  describeEpubProcessStatus,
  hydrateEpubArtifactsFromSupabase,
  EPUB_DEDUPE,
  EPUB_STAGES,
} from "@/lib/research/epub/runner";
