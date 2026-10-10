# Theme Routing

## Auto-detect Language

Use `zh` when CJK is material or appears in the title/topic; otherwise use `en`. Apply to placeholders, TOC labels, date display, and shell labels.

## Theme Selection (first match wins)

| Signal | Theme |
|--------|-------|
| weekly/daily/monthly/work progress/周报/日报/月报/本周/下周 | `regular-lumen` |
| sales/revenue/KPI/quarterly/business/销售/营收/业绩/季报 | `corporate-blue` |
| research/survey/whitepaper/internal/研究/调研/白皮书 | `minimal` |
| tech/architecture/API/system/performance/工程/架构 | `dark-tech` |
| news/industry/trend/新闻/行业/趋势 | `newspaper` |
| retrospective/proposal/复盘/回顾/工作总结·项目总结·阶段总结·年终总结/方案/提案/建议书 | `forest-editorial` |
| annual/story/growth/年度/增长 | `data-story` |
| formal document/official notice/公文/正式报告/通知/制度 | `fangsong` |
| board/dashboard/status/看板 | `dark-board` |
| generic project progress/项目进展/项目状态 | `corporate-blue` |

`forest-editorial` sits below the more specific signals on purpose: an explicit
`周报`/`月报` stays `regular-lumen`, `季度业绩` stays `corporate-blue`, and
`技术方案` stays `dark-tech` — only the retrospective/summary/proposal reports
that no sharper signal claims land here. `data-story` is now purely the
data-shaped narrative (年度/增长); the retrospective keywords moved out.
`forest-editorial` also implies a full-screen cover
(`references/html-shell/cover.md`) with no way to turn it off, so it conflicts
with `animations: scrollytelling|iridescence`.

Summary keywords are matched as compounds (`工作总结`, `项目总结`) rather than a
bare `总结`, because keyword matching runs over the whole IR text — a bare
`总结` would be claimed by every report that merely has a 总结 section.
Style words (`米绿`/`纸感`/`林绿`/`森林`/`editorial`) also select it.

## Report Class

Classify content by numeric density: `narrative` < 5%, `mixed` 5-20%, `data` > 20%; short topics default to `mixed`.
