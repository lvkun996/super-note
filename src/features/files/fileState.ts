export type ComparableFileMetadata = {
  exists: boolean;
  mtimeMs?: number;
  size?: number;
};

export function hasExternalFileChange(
  known: { lastKnownMtimeMs?: number; lastKnownSize?: number },
  current: ComparableFileMetadata,
) {
  if (!current.exists) {
    return true;
  }
  if (known.lastKnownMtimeMs == null && known.lastKnownSize == null) {
    return false;
  }
  return known.lastKnownMtimeMs !== current.mtimeMs || known.lastKnownSize !== current.size;
}
