import { useEffect, useState } from "react";
import {
  DEFAULT_MIND_MAP_STYLE,
  MIND_MAP_PALETTES,
  type MindMapBranchShape,
  type MindMapFontFamily,
  type MindMapPalette,
  type MindMapStyle,
  type MindMapStructure,
  type MindMapTopicFill,
  type MindMapTopicShape,
} from "./mindMapTypes";

type StyleWindowState = {
  tabId: string;
  title?: string;
  style: MindMapStyle;
  darkMode: boolean;
};

type PanelTab = "style" | "layout" | "canvas";

const structures: MindMapStructure[] = ["balanced", "right"];
const branchShapes: Array<{ value: MindMapBranchShape; path: string }> = [
  { value: "curve", path: "M2 18 C22 18 18 4 46 4" },
  { value: "elbow", path: "M2 18 H25 V4 H46" },
  { value: "straight", path: "M2 18 L46 4" },
];
const topicShapes: MindMapTopicShape[] = ["rounded", "pill", "underline"];
const topicFills: MindMapTopicFill[] = ["white", "soft", "solid"];
const backgrounds = ["#ffffff", "#f8fafc", "#f5f3ff", "#eff6ff", "#f0fdf4", "#fff7ed", "#fef2f2", "#f1f5f9"];

function isStyleWindowState(value: unknown): value is StyleWindowState {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<StyleWindowState>;
  return typeof candidate.tabId === "string" && Boolean(candidate.style) && typeof candidate.style === "object";
}

function normalizeStyleWindowState(value: unknown): StyleWindowState | null {
  if (!isStyleWindowState(value)) {
    return null;
  }
  return {
    ...value,
    darkMode: value.darkMode === true,
    style: { ...DEFAULT_MIND_MAP_STYLE, ...value.style },
  };
}

function SectionTitle({ children }: { children: string }) {
  return <h2 className="property-section-title"><span>▾</span>{children}</h2>;
}

export function MindMapStyleWindow() {
  const [windowState, setWindowState] = useState<StyleWindowState | null>(() => (
    normalizeStyleWindowState(window.superNote?.getInitialMindMapStyleState?.())
  ));
  const [activeTab, setActiveTab] = useState<PanelTab>("style");

  useEffect(() => {
    document.title = "思维导图样式 - Super Note";
    return window.superNote?.onMindMapStyleState?.((payload) => {
      const next = normalizeStyleWindowState(payload);
      if (!next) {
        return;
      }
      setWindowState(next);
    });
  }, []);

  useEffect(() => {
    document.body.classList.toggle("mind-map-style-dark", windowState?.darkMode === true);
  }, [windowState?.darkMode]);

  const applyPatch = (patch: Partial<MindMapStyle>) => {
    setWindowState((current) => {
      if (!current) {
        return current;
      }
      const next = { ...current, style: { ...current.style, ...patch } };
      void window.superNote?.updateMindMapStyle?.({ tabId: current.tabId, style: next.style, darkMode: current.darkMode });
      return next;
    });
  };

  if (!windowState) {
    return <main className="mind-map-style-window loading">•••</main>;
  }

  const { style } = windowState;
  return (
    <main className={`mind-map-style-window${windowState.darkMode ? " dark-mode" : ""}`}>
      <nav className="property-tabs" aria-label="样式属性页">
        {([['style', '样式'], ['layout', '布局'], ['canvas', '画布']] as const).map(([value, label]) => (
          <button key={value} type="button" className={activeTab === value ? "selected" : ""} onClick={() => setActiveTab(value)}>{label}</button>
        ))}
      </nav>

      {activeTab === "style" ? (
        <>
          <section className="property-section">
            <SectionTitle>形状</SectionTitle>
            <div className="property-row">
              <span>形状</span>
              <div className="visual-options three">
                {topicShapes.map((shape) => (
                  <button key={shape} type="button" className={style.topicShape === shape ? "selected" : ""} title={shape} aria-label={shape} onClick={() => applyPatch({ topicShape: shape })}>
                    <i className={`topic-shape-preview ${shape}`} />
                  </button>
                ))}
              </div>
            </div>
            <div className="property-row">
              <span>填充</span>
              <div className="visual-options three">
                {topicFills.map((fill) => (
                  <button key={fill} type="button" className={style.topicFill === fill ? "selected" : ""} title={fill} aria-label={fill} onClick={() => applyPatch({ topicFill: fill })}>
                    <i className={`fill-preview ${fill}`} />
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="property-section">
            <SectionTitle>文本</SectionTitle>
            <div className="property-grid two">
              <select value={style.fontFamily} aria-label="字体" onChange={(event) => applyPatch({ fontFamily: event.target.value as MindMapFontFamily })}>
                <option value="system">System UI</option>
                <option value="serif">Serif</option>
                <option value="mono">Mono</option>
              </select>
              <select value={style.fontScale} aria-label="字号" onChange={(event) => applyPatch({ fontScale: Number(event.target.value) })}>
                <option value="0.85">85%</option>
                <option value="1">100%</option>
                <option value="1.15">115%</option>
                <option value="1.3">130%</option>
              </select>
            </div>
            <div className="property-grid weight-grid">
              {([500, 600, 700] as const).map((weight) => (
                <button key={weight} type="button" className={style.fontWeight === weight ? "selected" : ""} style={{ fontWeight: weight }} onClick={() => applyPatch({ fontWeight: weight })}>B</button>
              ))}
              <label className="color-control" title="文字颜色">
                <input type="color" value={style.textColor} onChange={(event) => applyPatch({ textColor: event.target.value })} />
                <i style={{ background: style.textColor }} />
              </label>
            </div>
          </section>

          <section className="property-section">
            <SectionTitle>分支</SectionTitle>
            <div className="visual-options branch-options">
              {branchShapes.map((option) => (
                <button key={option.value} type="button" className={style.branchShape === option.value ? "selected" : ""} title={option.value} aria-label={option.value} onClick={() => applyPatch({ branchShape: option.value })}>
                  <svg viewBox="0 0 48 22" aria-hidden="true"><path d={option.path} /></svg>
                </button>
              ))}
            </div>
            <div className="property-row">
              <span>线宽</span>
              <select value={style.branchWidth} onChange={(event) => applyPatch({ branchWidth: Number(event.target.value) as MindMapStyle["branchWidth"] })}>
                <option value="1">细</option>
                <option value="2">标准</option>
                <option value="3">粗</option>
                <option value="4">加粗</option>
              </select>
            </div>
            <label className="property-check-row">
              <input type="checkbox" checked={style.coloredBranches} onChange={(event) => applyPatch({ coloredBranches: event.target.checked })} />
              <span>彩虹分支</span>
              <i className="palette-wheel" />
            </label>
            <div className="palette-options">
              {(Object.keys(MIND_MAP_PALETTES) as MindMapPalette[]).map((palette) => (
                <button key={palette} type="button" className={style.palette === palette ? "selected" : ""} title={palette} onClick={() => applyPatch({ palette })}>
                  {MIND_MAP_PALETTES[palette].slice(0, 5).map((color) => <i key={color} style={{ background: color }} />)}
                </button>
              ))}
            </div>
          </section>
        </>
      ) : null}

      {activeTab === "layout" ? (
        <>
          <section className="property-section">
            <SectionTitle>结构</SectionTitle>
            <div className="structure-options">
              {structures.map((structure) => (
                <button key={structure} type="button" className={style.structure === structure ? "selected" : ""} title={structure} aria-label={structure} onClick={() => applyPatch({ structure })}>
                  <span className={`structure-preview ${structure}`} aria-hidden="true"><i /><i /><i /><i /><i /></span>
                </button>
              ))}
            </div>
          </section>
          <section className="property-section">
            <SectionTitle>间距</SectionTitle>
            <label className="compact-range"><span>↔</span><input type="range" min="56" max="180" step="4" value={style.horizontalGap} onChange={(event) => applyPatch({ horizontalGap: Number(event.target.value) })} /><b>{style.horizontalGap}</b></label>
            <label className="compact-range"><span>↕</span><input type="range" min="10" max="64" step="2" value={style.verticalGap} onChange={(event) => applyPatch({ verticalGap: Number(event.target.value) })} /><b>{style.verticalGap}</b></label>
          </section>
        </>
      ) : null}

      {activeTab === "canvas" ? (
        <>
          <section className="property-section">
            <SectionTitle>背景</SectionTitle>
            <div className="background-options">
              {backgrounds.map((background) => (
                <button key={background} type="button" className={style.background === background ? "selected" : ""} style={{ background }} title={background} onClick={() => applyPatch({ background })} />
              ))}
            </div>
          </section>
          <section className="property-section">
            <SectionTitle>主题色</SectionTitle>
            <div className="palette-options large">
              {(Object.keys(MIND_MAP_PALETTES) as MindMapPalette[]).map((palette) => (
                <button key={palette} type="button" className={style.palette === palette ? "selected" : ""} title={palette} onClick={() => applyPatch({ palette })}>
                  {MIND_MAP_PALETTES[palette].map((color) => <i key={color} style={{ background: color }} />)}
                </button>
              ))}
            </div>
          </section>
        </>
      ) : null}

      <footer className="property-footer">
        <button type="button" onClick={() => applyPatch({ ...DEFAULT_MIND_MAP_STYLE })}>重设样式</button>
      </footer>
    </main>
  );
}
