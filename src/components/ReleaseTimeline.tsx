import { uiText } from "../../electron/uiLanguage";

const releaseTimeline: Array<{ version: string; date: string; title: string; description: string; upcoming?: boolean }> = [
  {
    version: "v0.1.34",
    date: "2026-10-10",
    title: uiText("导航边界与独立思维导图"),
    description: uiText("修复导航白线并增加正文左上圆角；思维导图独立为需勾选启用的插件，保留已有导图与混合内容。"),
  },
  {
    version: "v0.1.33",
    date: "2026-10-09",
    title: uiText("输入修复与聚焦背景优化"),
    description: uiText("修复已有文件异常换行造成的光标错位；聚焦时仅导航背景半透明，欢迎词随机切换，并完善一键发布校验。"),
  },
  {
    version: "v0.1.32",
    date: "2026-10-09",
    title: uiText("侧栏拖拽与性能优化"),
    description: uiText("侧栏拖拽新增半透明浮动预览；优化搜索、标题生成和编辑器覆盖层更新，减少无效计算。"),
  },
  {
    version: "v0.1.31",
    date: "2026-09-22",
    title: uiText("大文本与保存体验优化"),
    description: uiText("保存 JSON 时自动规范格式；大文本改为安全只读预览，并优化窗口聚焦时的边框透明度。"),
  },
  {
    version: "v0.1.30",
    date: "2026-09-14",
    title: uiText("锚点标识与导航细节统一"),
    description: uiText("正文锚点增加连续数字标识；统一顶部菜单悬浮样式、窗口聚焦透明度和侧栏操作区高度。"),
  },
  {
    version: "v0.1.29",
    date: "2026-09-11",
    title: uiText("锚点导航与窗口层次优化"),
    description: uiText("选中文本后可设置锚点，从标题栏列表快速跳转；窗口失焦时淡化非内容区域，并降低滚动条存在感。"),
  },
  {
    version: "v0.1.27",
    date: "2026-09-07",
    title: uiText("欢迎页与文件保存修复"),
    description: uiText("放大欢迎页文字，修复作者页全屏间隙，优化 Markdown 标题栏按钮提示，并正确保留用户输入的文件后缀。"),
  },
  {
    version: "v0.1.26",
    date: "2026-09-07",
    title: uiText("JSON 与 Markdown 编辑体验"),
    description: uiText("打开 JSON 文件时自动格式化内容，Markdown 默认预览并通过独立弹窗实时编辑，同时优化保存目录输入和网站界面。"),
  },
  {
    version: "v0.1.25",
    date: "2026-09-04",
    title: uiText("双语界面与透明弹窗"),
    description: uiText("设置支持中英文切换，统一透明弹窗与灰黑控件，文档改为操作列表，并优化置顶与缩放重置文案。"),
  },
  {
    version: "v0.1.24",
    date: "2026.09.04",
    title: uiText("修复左侧布局标题栏间隙"),
    description: uiText("统一移除文本区域顶部圆角与灰色间隙，左侧布局标题栏紧贴操作栏。"),
  },
  {
    version: "v0.1.23",
    date: "2026.09.04",
    title: uiText("顶栏边界与多选撤销修复"),
    description: uiText("顶部文本区域取消多余弧形灰底，多行中键编辑撤销时同步恢复焦点位置。"),
  },
  {
    version: "v0.1.22",
    date: "2026.09.04",
    title: uiText("界面配色与中键编辑优化"),
    description: uiText("统一导航区域为浅灰背景，欢迎页更贴近设计稿；托盘菜单避开图标并缩小，中键多选恢复原生色系且支持撤销。"),
  },
  {
    version: "v0.1.21",
    date: "2026.09.03",
    title: uiText("默认欢迎页与托盘入口"),
    description: uiText("托盘左键直接打开主窗口；横栏布局直达文本编辑区；首次启动、完全重启和点击 Super Note 时展示默认欢迎页。"),
  },
  {
    version: "v0.1.20",
    date: "2026.09.03",
    title: uiText("文本标题栏与光标修复"),
    description: uiText("文本模块采用顶部圆角与独立文档标题栏，支持标题菜单操作；修复输入时光标回退，多光标改为不闪烁、不挤占文字空间的独立覆盖层。"),
  },
  {
    version: "v0.1.19",
    date: "2026.09.02",
    title: uiText("修复在线更新下载"),
    description: uiText("安装包补齐自动更新配置与缓存目录，解决检测到新版本后下载时报 app-update.yml 缺失的问题，并加入打包配置校验。"),
  },
  {
    version: "v0.1.18",
    date: "2026.09.02",
    title: uiText("统一导航配色与置顶分组"),
    description: uiText("顶栏与顶部标签沿用侧栏配色，操作栏更紧凑；左侧新增可持久化的 Pinned 分组与取消置顶。同步改进文本保存、标签位置恢复、搜索范围和缩放提示。"),
  },
  {
    version: "v0.1.17",
    date: "2026.08.28",
    title: uiText("保存命名与标签菜单优化"),
    description: uiText("首次保存文本时使用当前标签标题并统一为 .snote 文件，标签右键菜单同步收紧尺寸、间距与视觉层级。"),
  },
  {
    version: "v0.1.16",
    date: "2026.08.27",
    title: uiText("标签操作、保存位置与搜索入口"),
    description: uiText("两种布局的标签右键菜单新增置顶、删除、编辑和资源管理器定位；设置可选择默认保存位置，并加入顶部搜索入口、长按竖向多光标同步输入与打赏作者页面。"),
  },
  {
    version: "v0.1.15",
    date: "2026.08.25",
    title: uiText("可调侧栏、全屏与缩放反馈"),
    description: uiText("左侧标签栏支持实时拖拽调宽并精简视觉元素，侧栏模式聚焦单栏编辑；新增 Ctrl + H 全屏、缩放倍率提示和 Ctrl + 0 恢复 100%。"),
  },
  {
    version: "v0.1.14",
    date: "2026.08.20",
    title: uiText("标签导航与 Windows 文件集成"),
    description: uiText("新增标签拖拽排序和 Ctrl + B 左侧标签菜单，优化标签渲染与代码层级，并扩展 Windows 默认打开和资源管理器预览支持。"),
  },
  {
    version: "v0.1.13",
    date: "2026.08.12",
    title: uiText("画板思维导图与内容关联"),
    description: uiText("增加思维导图、主题跨层级拖动、文字与图片关联、连线吸附点拖拽和画板图片导出，并优化样式面板启动与夜间模式。"),
  },
  {
    version: "v0.1.12",
    date: "2026.08.11",
    title: uiText("更新与文本操作优化"),
    description: uiText("修复低版本更新提示，增加中键竖向选中文本与 Ctrl + 滚轮调整字号，并让 Markdown 默认进入预览模式。"),
  },
  {
    version: "v0.1.11",
    date: "2026.08.07",
    title: uiText("工作区安全与文件操作优化"),
    description: uiText("增加工作区备份恢复、外部文件变化检测、最近文件和快速打开，并优化 Markdown 预览体验。"),
  },
  {
    version: "v0.1.10",
    date: "2026.08.04",
    title: uiText("标签关闭状态与全屏弹窗优化"),
    description: uiText("优化当前标签关闭状态提示、全屏版本与作者弹窗布局，并新增 .snote 文件的 Windows 资源管理器预览注册。"),
  },
  {
    version: "v0.1.9",
    date: "2026.07.20",
    title: uiText("标签、托盘与弹窗体验"),
    description: uiText("更新分栏与标签切换快捷键，新增内容标签名和最近标签托盘菜单，并优化全屏版本页、弹窗滚动与标签栏溢出。"),
  },
  {
    version: "v0.1.8",
    date: "2026.07.17",
    title: uiText("链接、搜索与编辑体验"),
    description: uiText("修复文本底部点击和搜索定位，新增 Ctrl + 单击外部链接、固定编辑菜单，并按功能拆分核心代码。"),
  },
  {
    version: "v0.1.7",
    date: "2026.07.09",
    title: uiText("透明图标与作者全屏"),
    description: uiText("更新透明背景的新 logo，作者寄语改为全屏展示，优化标签栏边框，并暂时移除文本对比插件。"),
  },
  {
    version: "v0.1.6",
    date: "2026.07.08",
    title: uiText("自动更新与全局快捷键"),
    description: uiText("根据凯哥的提议，新增自动更新按钮、Windows 版本通道识别、一键发布脚本，以及 Ctrl + Alt + 空格全局打开/隐藏。"),
  },
  {
    version: "v0.1.5",
    date: "2026.07.08",
    title: uiText("为凯哥更新的版本"),
    description: uiText("新增凯哥生日快乐独立页面，用纯 CSS 做蛋糕、礼物、烟花与生日签互动；同时保留空工作区、插件开关、安装目录选择和本地打包缓存优化。"),
  },
  {
    version: "v0.1.4",
    date: "2026.06.30",
    title: uiText("文本模块字号与滚动空间"),
    description: uiText("新增文本模块字号放大、缩小快捷键设置，并把文本编辑区底部空白扩展到约 22 行。"),
  },
  {
    version: "v0.1.3",
    date: "2026.06.24",
    title: uiText("更多 Windows 版本支持"),
    description: uiText("新增 Windows 7 / 8 安装包，同时保留 Windows 10 / 11 独立下载入口。"),
  },
  {
    version: "v0.1.2",
    date: "2026.06.23",
    title: uiText("项目网站与直接下载"),
    description: uiText("重构项目页面视觉与响应式布局，安装包可从网站直接下载。"),
  },
  {
    version: "v0.1.1",
    date: "2026.06.22",
    title: uiText("多栏工作区"),
    description: uiText("加入自由画板、动态分栏、全局搜索与本地工作区保存。"),
  },
];

export function ReleaseTimeline() {
  return (
    <ol className="help-update-timeline">
      {releaseTimeline.map((release) => (
        <li key={release.version} className={release.upcoming ? "upcoming" : ""}>
          <span className="help-update-marker" aria-hidden />
          <article>
            <div className="help-update-meta">
              <strong>{release.version}</strong>
              <span>{release.date}</span>
            </div>
            <h4>{release.title}</h4>
            <p>{release.description}</p>
          </article>
        </li>
      ))}
    </ol>
  );
}
