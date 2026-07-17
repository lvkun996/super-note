import { EditOutlined, FileTextOutlined, PlusOutlined } from "@ant-design/icons";

export function EmptyWorld() {
  return (
    <div className="empty-world" aria-label="没有标签页">
      <div className="empty-world-glow empty-world-glow-one" aria-hidden="true" />
      <div className="empty-world-glow empty-world-glow-two" aria-hidden="true" />
      <div className="empty-world-content">
        <div className="empty-world-mark" aria-hidden="true">
          <EditOutlined />
        </div>
        <div className="empty-world-kicker">SUPER NOTE · YOUR QUIET SPACE</div>
        <h1 className="empty-world-title">编写你的世界</h1>
        <p className="empty-world-description">捕捉一闪而过的念头，把零散灵感慢慢写成自己的宇宙。</p>
        <div className="empty-world-hints" aria-label="快速开始提示">
          <span className="empty-world-hint">
            <PlusOutlined />
            <span>
              <strong>新建文本</strong>
              <small>点击标签栏的 +</small>
            </span>
          </span>
          <span className="empty-world-hint">
            <FileTextOutlined />
            <span>
              <strong>打开文件</strong>
              <small>直接拖入这个窗口</small>
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
