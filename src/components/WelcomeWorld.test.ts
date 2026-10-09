import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setUiLanguage } from "../../electron/uiLanguage";
import { WelcomeWorld } from "./WelcomeWorld";

afterEach(() => {
  vi.restoreAllMocks();
  setUiLanguage("zh-CN");
});

describe("welcome messages", () => {
  it.each([
    [0, "你想写些什么？"],
    [0.34, "灵感涌现"],
    [0.67, "记录此时"],
    [0.999999, "记录此时"],
  ])("selects a message for random value %s", (random, message) => {
    vi.spyOn(Math, "random").mockReturnValue(random);
    const html = renderToStaticMarkup(createElement(WelcomeWorld));
    expect(html).toContain(`<p>${message}</p>`);
    expect(html).toContain('aria-label="欢迎页"');
  });

  it.each([
    [0, "What would you like to write?"],
    [0.34, "Let inspiration flow"],
    [0.67, "Capture this moment"],
  ])("translates the selected message for random value %s", (random, message) => {
    setUiLanguage("en-US");
    vi.spyOn(Math, "random").mockReturnValue(random);
    expect(renderToStaticMarkup(createElement(WelcomeWorld))).toContain(`<p>${message}</p>`);
  });
});
