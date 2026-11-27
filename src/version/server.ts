import { cache } from "@overextended/ox_lib/cache";
import semver from "semver";

function normalizeRange(version = "") {
  const trimmed = version.trim();

  return semver.valid(trimmed) ? `^${semver.clean(trimmed)}` : semver.validRange(trimmed);
}

function checkResourceDependencies(resource: string) {
  const dependencies = GetNumResourceMetadata(resource, "fx_dependencie");

  if (!dependencies) return;

  const errors = [];

  for (let index = 0; index < dependencies; index++) {
    const metadata = GetResourceMetadata(resource, "fx_dependencie", index);
    const [dependency, version] = metadata.split(":", 2);
    const range = normalizeRange(version);

    if (!dependency || !range) {
      errors.push(`Resource '${resource}' depends on invalid semver syntax (received ${metadata}).`);
      continue;
    }

    const currentVersion = GetResourceMetadata(dependency, "version", 0);

    if (!semver.valid(currentVersion)) {
      errors.push(`Resource '${dependency}' version is not valid semver syntax (received ${currentVersion}).`);
      continue;
    }

    if (!semver.satisfies(currentVersion, range)) {
      errors.push(
        `Resource '${dependency}' v${currentVersion} does not satisfy version requirement for '${resource}' (expects ${semver.validRange(range)}).`,
      );
      continue;
    }
  }

  if (!errors.length) return;

  const url = GetResourceMetadata(resource, "repository", 0) || GetResourceMetadata(resource, "url", 0);

  if (url) errors.push(`  - ${url}`);

  console.log(`^1${errors.join("\n")}^0`);

  if (cache.resource !== resource) StopResource(resource);
}

on("onServerResourceStart", checkResourceDependencies);
