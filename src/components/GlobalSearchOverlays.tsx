import { uiText } from "../../electron/uiLanguage";
import { FileTextOutlined, FolderOpenOutlined, HistoryOutlined, SearchOutlined } from "@ant-design/icons";
import { Empty, Input } from "antd";
import type { QuickOpenItem, SearchResult } from "../appTypes";
import { renderHighlightedText } from "../features/editor/editorUtils";

type GlobalSearchOverlaysProps = {
  quickOpenOpen: boolean;
  quickOpenValue: string;
  quickOpenResults: QuickOpenItem[];
  onQuickOpenValueChange: (value: string) => void;
  onOpenQuickOpenResult: (result: QuickOpenItem) => void | Promise<void>;
  searchOpen: boolean;
  searchScope: "current" | "all";
  searchValue: string;
  deferredSearchValue: string;
  searchResults: SearchResult[];
  onSearchValueChange: (value: string) => void;
  onOpenSearchResult: (result: SearchResult) => void | Promise<void>;
  onCloseSearch: () => void;
};

export function GlobalSearchOverlays({
  quickOpenOpen,
  quickOpenValue,
  quickOpenResults,
  onQuickOpenValueChange,
  onOpenQuickOpenResult,
  searchOpen,
  searchScope,
  searchValue,
  deferredSearchValue,
  searchResults,
  onSearchValueChange,
  onOpenSearchResult,
  onCloseSearch,
}: GlobalSearchOverlaysProps) {
  return (
    <>
      {quickOpenOpen ? (
        <div className="global-search-layer">
          <div className="global-search-box">
            <Input
              id="quick-open-input"
              autoFocus
              allowClear
              prefix={<FolderOpenOutlined />}
              placeholder={uiText("输入标签名、文件名或路径")}
              value={quickOpenValue}
              onChange={(event) => onQuickOpenValueChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && quickOpenResults[0]) {
                  event.preventDefault();
                  void onOpenQuickOpenResult(quickOpenResults[0]);
                }
              }}
              suffix={uiText("{0} 个结果", [quickOpenResults.length])}
            />
            <div className="search-results">
              {quickOpenResults.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={uiText("没有匹配的标签或最近文件")} /> : null}
              {quickOpenResults.map((result) => (
                <button key={result.id} type="button" className="search-result" onClick={() => void onOpenQuickOpenResult(result)}>
                  <span className="search-result-title">
                    {result.kind === "recent" ? <HistoryOutlined /> : <FileTextOutlined />}
                    {result.title}
                  </span>
                  <span className="search-result-preview">{result.detail}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
      {searchOpen ? (
        <div className="global-search-layer">
          <div className="global-search-box">
            <Input
              id="global-search-input"
              autoFocus
              allowClear
              prefix={<SearchOutlined />}
              placeholder={searchScope === "current" ? uiText("搜索当前页内容，再按一次 Ctrl+F 搜索全部标签") : uiText("搜索所有标签内容")}
              value={searchValue}
              onChange={(event) => onSearchValueChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && searchResults[0]) {
                  event.preventDefault();
                  void onOpenSearchResult(searchResults[0]);
                  onCloseSearch();
                }
              }}
              suffix={searchValue ? uiText("{0} · {1} 个匹配", [searchScope === "current" ? uiText("当前页") : uiText("全部标签"), searchResults.length]) : null}
            />
            {searchValue.trim() ? (
              <div className="search-results">
                {searchResults.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={uiText("没有匹配内容")} /> : null}
                {searchResults.map((result) => (
                  <button
                    key={result.id}
                    type="button"
                    className="search-result"
                    onClick={() => {
                      void onOpenSearchResult(result);
                      onCloseSearch();
                    }}
                  >
                    <span className="search-result-title">
                      {result.kind !== "canvas-text" ? <FileTextOutlined /> : null}
                      {result.title}
                      {result.line ? uiText(" · 第 {0} 行", [result.line]) : ""}
                    </span>
                    <span className="search-result-preview">{renderHighlightedText(result.preview, deferredSearchValue)}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
