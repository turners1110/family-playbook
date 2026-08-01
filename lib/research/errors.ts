export class ResearchUnavailableError extends Error {
  readonly code = "research_unavailable" as const;

  constructor(
    message = "Research storage unavailable. New research entries are disabled.",
  ) {
    super(message);
    this.name = "ResearchUnavailableError";
  }
}

export class ResearchAuthError extends Error {
  readonly code = "research_auth" as const;

  constructor(message: string) {
    super(message);
    this.name = "ResearchAuthError";
  }
}

export class ResearchNotFoundError extends Error {
  readonly code = "research_not_found" as const;

  constructor(message = "Source not found.") {
    super(message);
    this.name = "ResearchNotFoundError";
  }
}
