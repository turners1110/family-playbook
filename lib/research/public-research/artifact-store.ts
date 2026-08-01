/**
 * In-process store for public research artifacts (local/tests).
 * Supabase mode persists via admin client in pipeline.ts.
 */
import { randomUUID } from "crypto";
import type {
  ResearchCoverageComparison,
  ResearchExternalSource,
  ResearchPreliminaryFinding,
  ResearchProcessingJob,
  ResearchPublicOverview,
} from "@/lib/research/types";

export type PublicResearchArtifactStore = {
  externalSources: ResearchExternalSource[];
  overviews: ResearchPublicOverview[];
  findings: ResearchPreliminaryFinding[];
  jobs: ResearchProcessingJob[];
  comparisons: ResearchCoverageComparison[];
};

const globalStore: PublicResearchArtifactStore = {
  externalSources: [],
  overviews: [],
  findings: [],
  jobs: [],
  comparisons: [],
};

export function getPublicResearchArtifactStore(): PublicResearchArtifactStore {
  return globalStore;
}

export function clearPublicResearchArtifactsForTests() {
  globalStore.externalSources = [];
  globalStore.overviews = [];
  globalStore.findings = [];
  globalStore.jobs = [];
  globalStore.comparisons = [];
}

export function newId(prefix: string) {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

export function nowIso() {
  return new Date().toISOString();
}
