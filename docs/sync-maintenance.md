# 本地同步维护（2026-10-11）

正式源：

| 源仓库 | 技能版本 | 正式 HEAD | 插件适配版本 |
| --- | --- | --- | --- |
| slide-creator | 2.34.2 | 7c0b34127d1a510e3cc73a9a27bbe4c9c0b3d3f1 | 3.6.0 |
| report-creator | 1.28.1 | bee5183ff8be0f5a8fc601d94f2a2a9bcf04d4b4 | 2.5.1 |

slide-creator 源仓库工作树干净（2026-10-12 已将结构化场景 WIP 合并发布为 v2.34.0–v2.34.2），vendor manifest 的 `source_dirty` 为 false；本次同步闭包逐项与上述正式 HEAD 的 Git 内容核对，不包含 candidate、私有 docs、eval traces、reports 或密钥。report-creator 与上次同步一致。原有未跟踪文件保留。

## 同步机制

运行 `scripts/vendor.sh slide-creator` / `report-creator`。slide 同步 renderer 依赖闭包、schemas、references、HTML demos 和 themes；新增 audience_readability/model_context/shader_hero_renderer 依赖，并声明 beautifulsoup4。插件自有 custom themes 保留。report 的正式源是 Python/HTML 技能仓库，只同步 references/themes，不覆盖插件自有 TypeScript MCP adapter、package 文件和 CSS 修复。脚本不再隐式执行 npm install/build，按 README 显式构建与测试。

两个 vendor manifest 记录源 SHA、源技能版本及同步文件 SHA-256。slide 的 compact contract 经 `get_model_context` 暴露；MCP 使用 `requested_preset` 传递独立用户风格约束，代替 CLI 的 request 文件，仍保持 IR 在内存。风格冲突在写入之前拒绝。两个 planner、plugin manifest、适配器声明版本与 legacy registry 一致。

report 的 forest-editorial 时间线 padding 修复已在适配器中存在。shared/dark-tech/dark-board CSS 含插件自有 shell/KPI/暗色兼容修复，不用上游 CSS 整体覆盖。

## 注册表发布边界

`registry.json` 更新本地插件版本。`registry-v2.json` 保留现有已发布源绑定：它只能从 committed Git objects 生成，并要求该提交可从 origin ref 到达。初轮按本地维护授权保留旧 v2；后续用户授权提交 GitHub，按正式源快照提交/push、再生成和提交 v2 的两步流程更新。发布资产和用户安装仍不在此次操作范围。初轮 v2 一致性测试仅验证旧固定提交。

后续正式发布时，先提交并 push 已验证的插件源快照，再运行 `node scripts/update-registry-v2.mjs --commit <source-sha>`，提交生成结果并对原 source-sha 执行 `--check`。不要绕过 origin 可达性检查，也不要将上游仓库 SHA 当作本仓库安装源 SHA。

## 验证范围

执行插件单元/集成测试、report TypeScript build 和自包含 bundle、两种 renderer 的真实 modern stdio 初始化/订阅/调用和代表性 HTML 渲染。优化评测暂停，未执行 npm eval 或源仓库的优化/候选评测。未执行 Desktop 打包、Windows 测试或用户安装升级；源测试环境与平台打包运行时是不同验证范围。

## 远程新鲜度补核

通过 `git ls-remote --symref origin HEAD` 只读核对：slide 默认 main 为 31a6ef1426b0d9764a37432370f20a8526ec7226（2026-10-09T18:20:10+08:00），包含正式 2.32.0 动效封面/离线播放发布；report 默认 master 为 bee5183ff8be0f5a8fc601d94f2a2a9bcf04d4b4，与本地一致。没有将旧评测基线当成最新远程源。

补同步 shader-hero、molten-flow、stellar-vortex 三个 custom theme、shader_hero_renderer、封面运行时和目录、新 demos、用户名称别名及静态导出控制。全部来自正式远程提交，未复制 source docs 或候选。

2026-10-12/13 两次只读核对：slide-creator 默认 main 最终为 7c0b34127d1a510e3cc73a9a27bbe4c9c0b3d3f1（v2.34.2，含此前本地结构化场景 WIP 合并发布 v2.34.0–v2.34.2 及 flow-relations 修复），工作树干净；据此同步 slide 插件至 3.6.0，闭包含 schemas/references/demos/themes 更新及新增 references/profile-templates/ 目录，vendor manifest `source_dirty` 为 false。registry-v2 仍绑定旧已发布快照 d86686d（3.5.0），本地工作树更新尚未提交。

本地 loader 从实际部署目录读取 plugin.json，不用 registry-v2 校对 legacy 目录版本；直接启动仓库 MCP 已验证。但本地仓库不会自动改变用户部署。managed install 从 v2 固定 SHA checkout 并校验 digest/version，保留旧 v2 意味着仍安装旧 3.4.0/2.5.0。若将新工作树强行配旧 v2 probe，会因版本/digest 不符拒绝。现有 registry 8 项通过只说明旧发布快照一致，不是新工作树已可发布。正式提交/push、重新生成 v2 并 --check 后，仍需新 generation/install 和平台 packaging 验证。

## GitHub 提交与索引绑定

用户随后授权提交 GitHub。正式插件源快照已提交并推送为 `d86686dbe6140e6569e6b728fb90ecdb8e2a635b`；registry-v2 从该不可变 Git 提交生成，绑定 slide 3.5.0 / report 2.5.1。其余插件内容哈希和版本保持不变，源 SHA 由正式生成器统一指向这个已发布到仓库的源快照。索引所在的后续提交与 source.commit 不同是预期行为，检查命令必须显式使用上述 source SHA。

初轮旧 v2 的安装限制已经由新的 commit/version/digest 绑定解决；用户安装和发布资产仍未操作。隔离安装检查与平台打包、用户部署更新是不同验证范围。
