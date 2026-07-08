export type PluginSettings = {
  canvas: boolean;
};

export const DEFAULT_PLUGIN_SETTINGS: PluginSettings = {
  canvas: false,
};

export function normalizePluginSettings(value?: Partial<PluginSettings>): PluginSettings {
  return {
    canvas: Boolean(value?.canvas),
  };
}
