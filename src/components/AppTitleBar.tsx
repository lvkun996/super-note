import { uiText } from "../../electron/uiLanguage";
import {
  BorderOutlined,
  CloudDownloadOutlined,
  CloseOutlined,
  MinusOutlined,
  MoonOutlined,
  PushpinFilled,
  PushpinOutlined,
  SearchOutlined,
  SunOutlined,
} from "@ant-design/icons";
import { Button, Dropdown, Tooltip } from "antd";
import type { MenuProps } from "antd";

type AppTitleBarProps = {
  fileMenu: MenuProps["items"];
  pluginMenu: MenuProps["items"];
  operationMenu: MenuProps["items"];
  helpMenu: MenuProps["items"];
  updateButtonVisible: boolean;
  updateButtonTitle: string;
  updateButtonLoading: boolean;
  updateButtonText: string;
  alwaysOnTop: boolean;
  darkMode: boolean;
  onOpenWelcome: () => void;
  onOpenSettings: () => void;
  onOpenSearch: () => void;
  onToggleAlwaysOnTop: () => void | Promise<void>;
  onToggleTheme: () => void;
  onUpdateClick: () => void | Promise<void>;
};

export function AppTitleBar({
  fileMenu,
  pluginMenu,
  operationMenu,
  helpMenu,
  updateButtonVisible,
  updateButtonTitle,
  updateButtonLoading,
  updateButtonText,
  alwaysOnTop,
  darkMode,
  onOpenWelcome,
  onOpenSettings,
  onOpenSearch,
  onToggleAlwaysOnTop,
  onToggleTheme,
  onUpdateClick,
}: AppTitleBarProps) {
  return (
    <header className="app-titlebar">
      <div className="titlebar-left">
        <span
          className="app-brand"
          role="button"
          tabIndex={0}
          aria-label={uiText("打开欢迎页")}
          onClick={onOpenWelcome}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onOpenWelcome();
            }
          }}
        >
          <span className="app-title-stack"><span className="app-title">Super Note</span></span>
        </span>
        <div className="menu-left">
          <Dropdown menu={{ items: fileMenu }} trigger={["click"]}><Button type="text">{uiText("文件")}</Button></Dropdown>
          <Dropdown menu={{ items: pluginMenu }} trigger={["click"]}><Button type="text">{uiText("插件")}</Button></Dropdown>
          <Dropdown menu={{ items: operationMenu }} trigger={["click"]}><Button type="text">{uiText("操作")}</Button></Dropdown>
          <Button type="text" onClick={onOpenSettings}>{uiText("设置")}</Button>
          <Dropdown menu={{ items: helpMenu }} trigger={["click"]}><Button type="text">{uiText("帮助")}</Button></Dropdown>
          {updateButtonVisible ? (
            <Tooltip title={updateButtonTitle}>
              <Button
                type="primary"
                size="small"
                className="update-button"
                icon={<CloudDownloadOutlined />}
                loading={updateButtonLoading}
                onClick={onUpdateClick}
              >
                {updateButtonText}
              </Button>
            </Tooltip>
          ) : null}
        </div>
      </div>
      <div className="window-controls">
        <Tooltip title={uiText("搜索全部标签")}>
          <Button type="text" className="window-control" aria-label={uiText("搜索")} icon={<SearchOutlined />} onClick={onOpenSearch} />
        </Tooltip>
        <Tooltip title={alwaysOnTop ? uiText("取消置顶") : uiText("窗口置顶")}>
          <Button
            type="text"
            className="window-control"
            icon={alwaysOnTop ? <PushpinFilled /> : <PushpinOutlined />}
            onClick={onToggleAlwaysOnTop}
          />
        </Tooltip>
        <Tooltip title={darkMode ? uiText("切换为日间模式") : uiText("切换为夜间模式")}>
          <Button type="text" className="window-control" icon={darkMode ? <SunOutlined /> : <MoonOutlined />} onClick={onToggleTheme} />
        </Tooltip>
        <Button type="text" className="window-control" icon={<MinusOutlined />} onClick={() => window.superNote?.minimizeWindow()} />
        <Button type="text" className="window-control" icon={<BorderOutlined />} onClick={() => window.superNote?.toggleMaximizeWindow()} />
        <Button type="text" className="window-control close" icon={<CloseOutlined />} onClick={() => window.superNote?.closeWindow()} />
      </div>
    </header>
  );
}
