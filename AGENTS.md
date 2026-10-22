# Super Note workspace conventions

Preserve unrelated uncommitted changes and installed application data.

## Publishing

- When the user explicitly requests a release, use the unified repository entry point: `npm.cmd run release` on Windows (`npm run release` elsewhere). It invokes `scripts/release.mjs`.
- Do not recreate the release workflow with separate packaging, tag, upload or Pages commands. The script validates, builds, packages, verifies, publishes and checks live deployment.
- Before invoking it, prepare the requested version in `package.json`, both version fields in `package-lock.json`, and `site/index.html` download/version references. Write the release notes to `docs/releases/v<version>.md`.
- Stage only files authorized for that release and commit them on `master`; the script intentionally refuses a dirty worktree. Never use `git add .`, force-push tags, or overwrite a published version.
- Use `npm.cmd run release -- --dry-run` to inspect the plan, and `npm.cmd run release:check` for local preflight. Neither mode publishes or builds.
- Default target is Windows 10/11. Include Win7/8 only when requested, via `npm.cmd run release:full` (also update its site download link).
- Do not automatically retry an interrupted or failed release. Only when the user explicitly requests a retry, use `--resume` for the same commit's draft before publication, or `--verify-only` for read-only verification after publication; do not republish published assets.
- A script-editing request alone does not authorize a release, commit, push or version bump. Do not claim publication until the script confirms public assets, updater manifests and the live Pages version.

### 发布执行与 token 控制

- 完成上述必要的版本、更新说明和提交准备后，只运行统一发布脚本；保留脚本内部自带的构建、测试和线上校验，不额外执行独立检查或预检。
- 不主动轮询、读取或分析中间日志，不逐阶段发送进度；等待脚本结束，仅报告最终结果。若执行工具必须恢复等待，只做取得退出状态所需的最低频率等待，不展开中间日志。
- 脚本失败立即停止，简述错误及已完成的发布状态；不自动排查回归失败、不修改代码或脚本、不重跑测试、不重试发布或只读校验。后续处理须由用户另行明确要求。
- 用户只要求发布时，不扩展为调试、优化或修复任务；如缺少必要发布信息，简述缺项，不擅自启动额外流程。
