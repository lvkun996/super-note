// DWM backdrops preserve normal resizing/maximizing, unlike transparent windows.
export function getWindowMaterial(platform: string, release: string, available: boolean): "acrylic" | undefined {
  const [major, , build] = release.split(".").map(Number);
  return available && platform === "win32" && major >= 10 && build >= 22621 ? "acrylic" : undefined;
}
