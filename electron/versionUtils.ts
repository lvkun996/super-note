const VERSION_PATTERN = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

type ParsedVersion = {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
};

function parseVersion(version: string): ParsedVersion | null {
  const match = VERSION_PATTERN.exec(version.trim());
  if (!match) {
    return null;
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4],
  };
}

export function isNewerVersion(candidateVersion: string, currentVersion: string) {
  const candidate = parseVersion(candidateVersion);
  const current = parseVersion(currentVersion);
  if (!candidate || !current) {
    return false;
  }

  for (const key of ["major", "minor", "patch"] as const) {
    if (candidate[key] !== current[key]) {
      return candidate[key] > current[key];
    }
  }

  if (candidate.prerelease == null || current.prerelease == null) {
    return candidate.prerelease == null && current.prerelease != null;
  }
  return candidate.prerelease > current.prerelease;
}
