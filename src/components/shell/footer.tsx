import { appConfig } from "@/config/app.config";
import { version } from "../../../package.json";

/** The release notes of one version on GitHub (release-please publishes a release for every version, `v<version>`). */
export function releaseNotesUrl(repoUrl: string, v: string): string {
  return `${repoUrl.replace(/\/+$/, "")}/releases/tag/v${v}`;
}

/** The GitHub mark (GitHub's own logo shape), drawn here because the icon library no longer includes brand logos. */
function GitHubMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" width="15" height="15" fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

/**
 * A quiet signature at the foot of every page (issue #275): who built it, the version that is live (linked to its
 * release notes) and a GitHub link. The same as the SolarEdge dashboard's footer, in the hub's tokens. The version
 * comes from package.json, which release-please keeps current; the page's own bottom padding already clears the
 * phone's bottom bar and the home indicator.
 */
export function Footer() {
  const link = "hit-44 rounded-sm font-semibold outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring";
  return (
    <footer className="mt-auto flex items-center justify-center gap-2.5 pt-4 pb-1 text-[11.5px] text-muted-foreground">
      <span>
        Built by{" "}
        <a href={appConfig.author.url} target="_blank" rel="noopener noreferrer" className={link}>
          {appConfig.author.name}
        </a>
      </span>
      <a
        href={releaseNotesUrl(appConfig.repoUrl, version)}
        target="_blank"
        rel="noopener noreferrer"
        title="Release notes for this version"
        className={`${link} font-medium tabular-nums`}
      >
        {`v${version}`}
        <span className="sr-only"> release notes</span>
      </a>
      <a href={appConfig.author.github} target="_blank" rel="noopener noreferrer" aria-label={`${appConfig.author.name} on GitHub`} className={`${link} inline-flex`}>
        <GitHubMark />
      </a>
    </footer>
  );
}
