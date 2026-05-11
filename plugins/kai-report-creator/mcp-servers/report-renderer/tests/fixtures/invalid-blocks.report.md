---
title: 错误示例
theme: unknown-theme
report_class: invalid_class
---

## 空KPI

:::kpi
:::

## 格式错误的时间线

:::timeline
- 没有冒号分隔
- 也没有日期格式
:::

## 缺少类型的图表

:::chart
labels: [a, b, c]
datasets:
  - name: test
    data: [1, 2, 3]
:::
