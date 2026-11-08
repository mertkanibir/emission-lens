const REPOSITORY = "https://github.com/mertkanibir/emission-lens";

/** The application owner supplies this revision from the verified web-build receipt. */
export function sourceLinks(webSourceRevision?: string) {
  const revision = webSourceRevision?.length === 40 && /^[a-f0-9]{40}$/i.test(webSourceRevision)
    ? webSourceRevision.toLowerCase()
    : null;
  return {
    source: revision ? `${REPOSITORY}/tree/${revision}` : REPOSITORY,
    sourceLabel: revision ? "Source for this build" : "Source repository",
    licence: `${REPOSITORY}/blob/main/LICENSE`,
    notice: `${REPOSITORY}/blob/main/NOTICE`,
    availability: `${REPOSITORY}/blob/main/release/SOURCE-AVAILABILITY.md`,
  };
}
