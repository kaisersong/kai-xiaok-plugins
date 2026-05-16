# Cloudhub 云之家 — Style Reference
# 云之家品牌风格参考文档

Professional, tech-forward, enterprise-grade. Based on Kingdee brand identity with Cloudhub-specific elements. Trustworthy blue tones, clean layouts, and authoritative typography. Designed for B2B solution presentations, product decks, and enterprise communications.

专业、科技感、企业级。基于金蝶品牌风格，加入云之家专属元素。可信赖的蓝色调、清晰的布局、权威的排版。专为 B2B 解决方案演示、产品方案和企业通信设计。

---

## 与 Kingdee 的差异 / Differences from Kingdee

| 项目 | Kingdee | Cloudhub |
|-----|---------|----------|
| Logo（白底用） | kingdee-blue.png | cloudhub_blue.png |
| Logo（蓝底用） | kingdee-white.png | cloudhub_white.png |
| 首页装饰图 | homepage.png（右侧装饰） | cloudhub_homepage.png（全屏背景） |
| 首页 Slogan | 无 | Cloudhub_slogan2025.png（右上角） |
| 首页标题样式 | 蓝色56磅，左对齐 | 白色54磅，居中，**单行显示** |
| 首页信息位置 | 左下角 | 底部**左移5%** |
| 首页信息内容 | 汇报人：XXX | **只显示人名**（无前缀） |
| 首页信息颜色 | 蓝色 | 白色 |
| 品牌名显示 | 金蝶 / Kingdee | 云之家 Cloudhub |
| ⭐ 版权信息 | 无 | 所有页面左下角，9.4磅 |
| ⭐ 保密标识 | 仅内容页 | 所有页面右下角，9.4磅 |

其他配色、字体、布局规范与 Kingdee 完全一致。

---

## Colors / 配色

```css
/* Primary palette / 主色系 */
:root {
    /* 蓝色渐变 */
    --kd-gradient-start:  #2372EF;   /* 渐变起点 */
    --kd-gradient-mid:    #238EF7;   /* 渐变中点 */
    --kd-gradient-end:    #22AAFE;   /* 渐变终点 */

    /* 品牌蓝 */
    --kd-blue:            #2971EB;   /* 品牌主蓝色 */

    /* 标准白 */
    --bg-white:           #FFFFFF;   /* 白色背景 */

    /* 辅助色系 / Secondary Colors */
    --kd-skyblue:         #22AAFE;   /* 天蓝 */
    --kd-skyblue-light:   #00CCFE;   /* 天蓝浅 */
    --kd-teal:            #05C8C8;   /* 蓝绿 */
    --kd-purple:          #A06EFF;   /* 紫色 */
    --kd-yellow:          #FFB61A;   /* 黄色 */

    /* 中性色 / Neutral Colors */
    --kd-black:           #000000;   /* 黑色（标准） */
    --kd-blue-purple:     #28235F;   /* 蓝紫 */
    --kd-gray-dark:       #3B3838;   /* 深灰 */
    --kd-gray:            #BFBFBF;   /* 灰色 */
    --kd-light-blue:      #E7F1FF;   /* 浅蓝 */

    /* 文字色（保持兼容） */
    --text-primary:       #1A1A1A;   /* 主要文字 */
    --text-secondary:     #666666;   /* 次要文字 */
    --text-on-blue:       #FFFFFF;   /* 蓝底上的文字 */

    /* 功能色（保持兼容） */
    --divider:            #E5E5E5;   /* 分割线 */
    --card-bg:            #F5F7FA;   /* 卡片背景 */
}
```

### 色彩规范汇总表

| 类别 | 色名 | 色值 | 用途 |
|------|------|------|------|
| **主色系** | 蓝色渐变起点 | #2372EF | 渐变背景起点 |
| | 蓝色渐变中点 | #238EF7 | 渐变背景中点 |
| | 蓝色渐变终点 | #22AAFE | 渐变背景终点 |
| | 品牌蓝 | #2971EB | 主要品牌色、按钮、链接 |
| | 白色 | #FFFFFF | 背景、反白文字 |
| **辅助色系** | 天蓝 | #22AAFE | 强调、图标 |
| | 天蓝浅 | #00CCFE | 高亮、装饰 |
| | 蓝绿 | #05C8C8 | 成功状态、数据图表 |
| | 紫色 | #A06EFF | 特殊强调、创意元素 |
| | 黄色 | #FFB61A | 警告、重点标注 |
| **中性色** | 黑色 | #000000 | 纯黑文字、边框 |
| | 蓝紫 | #28235F | 深色背景、标题 |
| | 深灰 | #3B3838 | 正文文字 |
| | 灰色 | #BFBFBF | 禁用状态、次要边框 |
| | 浅蓝 | #E7F1FF | 浅色背景、卡片 |

---

## Typography / 字体规范

```css
/* 统一字体设置 */
/* 中文字体：微软雅黑 | 英文字体：微软雅黑 */

/* 大标题 / Main Title */
.kd-title {
    font-family: "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", sans-serif;
    font-size: 24pt;          /* 24磅 */
    font-weight: 700;         /* 加粗 */
    color: var(--text-primary);
}

/* 副标题 / Subtitle */
.kd-subtitle {
    font-family: "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", sans-serif;
    font-size: 16pt;          /* 16磅 */
    font-weight: 400;         /* 普通 */
    color: var(--text-secondary);
}

/* 段落标题 / Section Title */
.kd-section-title-primary {
    font-family: "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", sans-serif;
    font-size: 22pt;          /* 22磅 - 一级段落标题 */
    font-weight: 700;         /* 加粗 */
    color: var(--text-primary);
}

.kd-section-title-secondary {
    font-family: "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", sans-serif;
    font-size: 18pt;          /* 18磅 - 二级段落标题 */
    font-weight: 700;         /* 加粗 */
    color: var(--text-primary);
}

/* 正文 / Body Text */
.kd-body {
    font-family: "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", sans-serif;
    font-size: 12pt;          /* 12磅 */
    font-weight: 400;         /* 普通 */
    line-height: 1.3;         /* 1.3倍行距 */
    color: var(--text-primary);
}

/* 标注文字 / Label Text */
.kd-label {
    font-family: "Microsoft YaHei", "PingFang SC", sans-serif;
    font-size: 10pt;          /* 10磅 */
    font-weight: 400;         /* 普通 */
    line-height: 1.3;         /* 1.3倍行距 */
    color: var(--text-secondary);
}

/* 重点强调 / Emphasis */
.kd-emphasis {
    font-family: "Microsoft YaHei", "PingFang SC", sans-serif;
    font-size: 20pt;          /* 20磅 */
    font-weight: 700;         /* 加粗 */
    color: var(--kd-blue);    /* 蓝色强调 */
}

.kd-emphasis-yellow {
    font-family: "Microsoft YaHei", "PingFang SC", sans-serif;
    font-size: 20pt;          /* 20磅 */
    font-weight: 700;         /* 加粗 */
    color: #F59E0B;           /* 黄色强调 */
}

/* 蓝色背景页的文字 / Text on blue background */
.kd-text-inverse {
    color: var(--text-on-blue);
}
```

### 字体规范汇总表

| 类型 | 字号 | 字重 | 行距 | 颜色 |
|------|------|------|------|------|
| 大标题 | 24磅 | 加粗 | - | 主色 #1A1A1A |
| 副标题 | 16磅 | 普通 | - | 次要色 #666666 |
| 段落标题(一级) | 22磅 | 加粗 | - | 主色 #1A1A1A |
| 段落标题(二级) | 18磅 | 加粗 | - | 主色 #1A1A1A |
| 正文 | 12磅 | 普通 | 1.3倍 | 主色 #1A1A1A |
| 标注文字 | 10磅 | 普通 | 1.3倍 | 次要色 #666666 |
| 重点强调(蓝) | 20磅 | 加粗 | - | 品牌蓝 #0052D9 |
| 重点强调(黄) | 20磅 | 加粗 | - | 黄色 #F59E0B |

---

## Layout Types / 布局类型

### 1. 首页 / Title Slide（Cloudhub 专属）

```css
.kd-slide-title {
    background: var(--bg-white);
    position: relative;
    height: 100vh;
}

/* 全屏背景图 */
.kd-hero-image {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    z-index: 1;
}

/* 左上角 Logo */
.kd-logo-left {
    position: absolute;
    top: 40px;
    left: 60px;
    height: 48px;
    z-index: 10;
}

/* ⭐ Cloudhub 专属：右上角 Slogan 图 */
.ch-slogan {
    position: absolute;
    top: 40px;
    right: 60px;
    height: 48px;            /* 与左上角 Logo 等高 */
    z-index: 10;
}

/* 主标题区域 - 居中 */
.kd-title-content {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    z-index: 5;
}

/* 主标题 - 白色，54磅，居中，单行显示 */
.kd-title-main {
    font-size: 54pt;
    font-weight: 700;
    color: #FFFFFF;
    line-height: 1.2;
    white-space: nowrap;     /* ⭐ 单行显示，不换行 */
}

/* 副标题 - 白色 */
.kd-subtitle {
    font-size: 16pt;
    font-weight: 400;
    color: #FFFFFF;
    margin-top: 20px;
}

/* 底部信息区域 - 左移5% */
.kd-slide-title-footer {
    position: absolute;
    left: 45%;               /* ⭐ 从50%改为45%，向左移动5% */
    transform: translateX(-50%);
    bottom: 60px;
    text-align: center;
    z-index: 10;
}

/* 人名 - 白色，18磅，只显示人名，无前缀 */
.kd-slide-title-author {
    font-size: 18pt;
    font-weight: 600;
    color: #FFFFFF;
    margin-bottom: 8px;
}

/* 文档创建时间 - 白色，18磅 */
.kd-slide-title-time {
    font-size: 18pt;
    font-weight: 400;
    color: #FFFFFF;
}

/* ⭐ 版权信息 - 左下角，9.4磅 */
.kd-copyright {
    position: absolute;
    bottom: 20px;
    left: 60px;
    font-size: 9.4pt;
    color: #FFFFFF;
    letter-spacing: 0.5px;
    z-index: 10;
}

/* 版权信息 - 灰色版本（目录页/内容页使用） */
.kd-copyright-gray {
    color: #808080;
}

/* ⭐ 保密标识 - 右下角，9.4磅 */
.kd-confidential {
    position: absolute;
    bottom: 20px;
    right: 60px;
    font-size: 9.4pt;
    color: #808080;
    letter-spacing: 0.5px;
    z-index: 10;
}

/* 保密标识 - 白色版本（首页/章节页/尾页使用） */
.kd-confidential-white {
    color: #FFFFFF;
}
```

#### 保密级别选项

根据序号或关键词选择保密级别（默认第4类）：

| 序号 | 关键词 | 显示文本 | 颜色规则 |
|-----|-------|---------|---------|
| 1 | 绝密 | ①绝密信息 严禁泄露 | 首页/章节页/尾页：白色；目录页/内容页：#808080 |
| 2 | 机密 | ②机密信息 严禁泄露 | 同上 |
| 3 | 秘密 | ③秘密信息 严禁泄露 | 同上 |
| 4 | 内部（默认） | ④内部公开 请勿外传 | 同上 |

#### 首页布局示例（Cloudhub）

```html
<section class="slide slide-title">
    <!-- 全屏背景图 -->
    <img class="kd-hero-image" src="https://static.yunzhijia.com/home/download/png/cloudhub_homepage.png" alt="首页全屏背景">
    <!-- 左上角 Logo -->
    <img class="kd-logo-left" src="https://static.yunzhijia.com/home/download/png/cloudhub_white.png" alt="Cloudhub 云之家 Logo">
    <!-- ⭐ 右上角 Slogan 图（Cloudhub 专属） -->
    <img class="ch-slogan" src="https://static.yunzhijia.com/home/download/png/Cloudhub_slogan2025.png" alt="云之家 Slogan">
    <!-- 主标题（居中，单行显示） -->
    <div class="kd-title-content">
        <h1 class="kd-title-main kd-reveal">云之家知识智能体解决方案</h1>
        <p class="kd-subtitle kd-reveal">V2.2</p>
    </div>
    <!-- 底部信息（左移5%，只显示人名，无前缀） -->
    <div class="kd-slide-title-footer kd-reveal">
        <div class="kd-slide-title-author">张靖华</div>
        <div class="kd-slide-title-time">2026年3月23日</div>
    </div>
    <!-- ⭐ 版权信息 - 左下角，白色 -->
    <div class="kd-copyright">版权所有©2026 云之家网络（重庆）有限公司</div>
    <!-- ⭐ 保密标识 - 右下角，白色 -->
    <div class="kd-confidential kd-confidential-white">④内部公开 请勿外传</div>
</section>
```

### 2. 内容页 / Content Slide

```css
.kd-slide-content {
    background: var(--bg-white);
    padding: 60px;
    position: relative;
}

/* 右上角 Logo */
.kd-logo-right {
    position: absolute;
    top: 50px;
    right: 60px;
    height: 54px;      /* 54px，与目录页一致 */
}

/* ⭐ 版权信息 - 左下角，9.4磅，灰色 */
.kd-copyright {
    position: absolute;
    bottom: 20px;
    left: 60px;
    font-size: 9.4pt;
    color: #808080;
    letter-spacing: 0.5px;
    z-index: 10;
}

/* ⭐ 保密标识 - 右下角，9.4磅，灰色 */
.kd-confidential {
    position: absolute;
    bottom: 20px;
    right: 60px;
    font-size: 9.4pt;
    color: #808080;
    letter-spacing: 0.5px;
    z-index: 10;
}

/*
 * 保密级别选项（根据序号或关键词选择）：
 * 1、绝密：①绝密信息 严禁泄露
 * 2、机密：②机密信息 严禁泄露
 * 3、秘密：③秘密信息 严禁泄露
 * 4、内部：④内部公开 请勿外传（默认）
 */

/* 标题栏：标题位置上移，与logo齐平 */
.kd-content-header {
    position: absolute;
    top: 50px;             /* 与logo的top位置一致 */
    left: 60px;
    right: 200px;          /* 为右侧logo留空间 */
    z-index: 10;
}

.kd-content-title {
    font-family: "Microsoft YaHei", "PingFang SC", sans-serif;
    font-size: 22pt;       /* 段落标题一级：22磅 */
    font-weight: 700;
    color: var(--text-primary);
    line-height: 1.2;
}

.kd-content-subtitle {
    font-family: "Microsoft YaHei", "PingFang SC", sans-serif;
    font-size: 18pt;       /* 段落标题二级：18磅 */
    font-weight: 400;
    color: var(--text-secondary);
    margin-top: 8px;
}

/* 内容区域 - 标题下方 */
.kd-content-body {
    margin-top: 100px;     /* 为标题区域留出空间 */
    font-size: 12pt;       /* 正文：12磅 */
    line-height: 1.3;      /* 1.3倍行距 */
}

/* ===========================================
   内容适配 / Content Adaptation
   解决内容较少时页面下半部分空白的问题
   =========================================== */

/* 内容垂直居中 - 适用于内容较少的页面 */
.kd-content-body.centered {
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-height: calc(100vh - 220px);  /* 减去header和footer */
    margin-top: 100px;                /* 为标题区域留空间 */
}

/* 内容弹性分布 - 适用于内容中等的页面 */
.kd-content-body.spread {
    display: flex;
    flex-direction: column;
    justify-content: space-evenly;    /* 均匀分布，首尾有间距 */
    min-height: calc(100vh - 220px);
    margin-top: 100px;
}

/* 底部装饰条 - 可选，为空白区域增加视觉元素 */
.kd-bottom-accent {
    position: absolute;
    bottom: 80px;
    left: 80px;
    right: 80px;
    height: 3px;
    background: linear-gradient(90deg, var(--kd-blue) 0%, transparent 100%);
    opacity: 0.3;
    z-index: 5;
}
```

#### 内容适配布局指南

根据内容量选择合适的布局方式：

| 内容量 | 布局类 | 效果 | 适用场景 |
|--------|--------|------|----------|
| 较多（填满页面） | 无（默认） | 从顶部开始排列 | 多段落、多列表、复杂内容 |
| 中等（占1/2~2/3页面） | `.spread` | 内容均匀分布 | 3-5个卡片/列表项 |
| 较少（占1/3页面以下） | `.centered` | 内容垂直居中 | 单个高亮框、指标卡片组 |

**使用示例：**

```html
<!-- 内容较少时：垂直居中 -->
<div class="kd-content-body centered">
    <div class="kd-highlight-box">...</div>
</div>

<!-- 内容中等时：弹性分布 -->
<div class="kd-content-body spread">
    <div class="kd-feature-card">...</div>
    <div class="kd-feature-card">...</div>
    <div class="kd-feature-card">...</div>
</div>

<!-- 内容较多时：默认布局 -->
<div class="kd-content-body">
    <p>...</p>
    <ul>...</ul>
</div>
```

### 3. 目录页 / TOC Slide

```css
.kd-slide-toc {
    background: var(--bg-white);    /* 白色底 */
    padding: 60px;
    position: relative;
}

/* 右上角 Logo - 放大50% (54px) */
.kd-logo-right-toc {
    position: absolute;
    top: 50px;
    right: 60px;
    height: 54px;                   /* 放大50% (原36px) */
    z-index: 10;
}

/* 全屏背景图 - kingdee_catalogue.png 平铺整个页面 */
.kd-toc-image {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    z-index: 1;
}

.kd-toc-content {
    position: absolute;
    left: 80px;
    right: 60px;                   /* 延伸到页面右边 */
    top: 50%;
    transform: translateY(-50%);
    z-index: 5;
    padding: 40px 0;               /* 无背景，仅垂直间距 */
}

/* 目录标题 - 位置上移与logo齐平 */
.kd-toc-title {
    font-family: "Microsoft YaHei", "PingFang SC", sans-serif;
    font-size: 24pt;               /* 24磅 */
    font-weight: 700;              /* 加粗 */
    line-height: 1.0;              /* 行距1.0 */
    color: var(--text-primary);
    margin-bottom: 40px;
    position: absolute;
    top: 50px;                     /* 与logo齐平 */
    left: 80px;
}

/* 目录副标题 - 微软雅黑常规16磅 */
.kd-toc-subtitle {
    font-family: "Microsoft YaHei", "PingFang SC", sans-serif;
    font-size: 16pt;               /* 16磅 */
    font-weight: 400;              /* 常规 */
    color: var(--text-secondary);
    margin-bottom: 30px;
}

/* 目录项容器 - 统一布局 */
.kd-toc-item {
    display: flex;
    align-items: center;
    margin-bottom: 28px;
    color: var(--text-primary);
    position: relative;            /* 为页码定位 */
}

/* 目录序号 - 蓝色，格式01、02等 */
/* 默认：54磅；条数 > 5 时：40磅 */
.kd-toc-number {
    font-family: "Microsoft YaHei", "PingFang SC", sans-serif;
    font-size: 54pt;               /* 默认54磅 */
    font-weight: 700;              /* 加粗 */
    color: var(--kd-blue);         /* 蓝色 */
    margin-right: 24px;
    min-width: 100px;
    line-height: 1;
}

/* ⭐ 目录条数 > 5 时：序号字体缩小为40磅 */
.kd-toc-number.compact {
    font-size: 40pt;               /* 条数 > 5 时使用40磅 */
    min-width: 80px;               /* 相应调整最小宽度 */
}

/* 目录内容 - 24磅，加粗 */
.kd-toc-text {
    font-family: "Microsoft YaHei", "PingFang SC", sans-serif;
    font-size: 24pt;               /* 24磅 */
    font-weight: 700;              /* 加粗 */
    color: var(--text-primary);
    flex: 1;
}

/* 目录页码 - 蓝色，加粗，距离页面右边150px */
.kd-toc-page {
    font-family: "Microsoft YaHei", "PingFang SC", sans-serif;
    font-size: 20pt;               /* 20磅 */
    font-weight: 700;              /* 加粗 */
    color: var(--kd-blue);         /* 蓝色 */
    position: absolute;
    right: 90px;                   /* 距离页面右边：60px(内容区域) + 90px = 150px */
}

/* ⭐ 版权信息 - 左下角，9.4磅，灰色 */
.kd-copyright {
    position: absolute;
    bottom: 20px;
    left: 60px;
    font-size: 9.4pt;
    color: #808080;
    letter-spacing: 0.5px;
    z-index: 10;
}

/* ⭐ 保密标识 - 右下角，9.4磅，灰色 */
.kd-confidential {
    position: absolute;
    bottom: 20px;
    right: 60px;
    font-size: 9.4pt;
    color: #808080;
    letter-spacing: 0.5px;
    z-index: 10;
}
```

### 目录页布局示例

**条数 ≤ 5 时（默认样式）：**

```html
<section class="slide slide-toc">
    <img class="kd-toc-image" src="https://static.yunzhijia.com/home/download/png/kingdee_catalogue.png" alt="目录页背景">
    <img class="kd-logo-right-toc" src="https://static.yunzhijia.com/home/download/png/cloudhub_blue.png" alt="Cloudhub 云之家 Logo">
    <h2 class="kd-toc-title">目 录</h2>
    <div class="kd-toc-content">
        <div class="kd-toc-item">
            <span class="kd-toc-number">01</span>
            <span class="kd-toc-text">本周项目全景图</span>
            <span class="kd-toc-page">P 03</span>
        </div>
        <div class="kd-toc-item">
            <span class="kd-toc-number">02</span>
            <span class="kd-toc-text">项目漏斗分析</span>
            <span class="kd-toc-page">P 04</span>
        </div>
    </div>
    <!-- ⭐ 版权信息 - 左下角，灰色 -->
    <div class="kd-copyright">版权所有©2026 云之家网络（重庆）有限公司</div>
    <!-- ⭐ 保密标识 - 右下角，灰色 -->
    <div class="kd-confidential">④内部公开 请勿外传</div>
</section>
```

**⭐ 条数 > 5 时（序号字体缩小为40磅）：**

```html
<section class="slide slide-toc">
    <img class="kd-toc-image" src="https://static.yunzhijia.com/home/download/png/kingdee_catalogue.png" alt="目录页背景">
    <img class="kd-logo-right-toc" src="https://static.yunzhijia.com/home/download/png/cloudhub_blue.png" alt="Cloudhub 云之家 Logo">
    <h2 class="kd-toc-title">目 录</h2>
    <div class="kd-toc-content">
        <div class="kd-toc-item">
            <span class="kd-toc-number compact">01</span>
            <span class="kd-toc-text">第一章节标题</span>
            <span class="kd-toc-page">P 03</span>
        </div>
        <div class="kd-toc-item">
            <span class="kd-toc-number compact">02</span>
            <span class="kd-toc-text">第二章节标题</span>
            <span class="kd-toc-page">P 05</span>
        </div>
        <!-- ... 更多条目，序号使用 compact 类 -->
        <div class="kd-toc-item">
            <span class="kd-toc-number compact">06</span>
            <span class="kd-toc-text">第六章节标题</span>
            <span class="kd-toc-page">P 12</span>
        </div>
    </div>
    <!-- ⭐ 版权信息 - 左下角，灰色 -->
    <div class="kd-copyright">版权所有©2026 云之家网络（重庆）有限公司</div>
    <!-- ⭐ 保密标识 - 右下角，灰色 -->
    <div class="kd-confidential">④内部公开 请勿外传</div>
</section>
```

### 4. 章节页 / Section Slide

```css
.kd-slide-section {
    background: var(--kd-blue);
    display: flex;
    align-items: flex-start;
    position: relative;
}

/* 全屏背景图 */
.kd-section-image {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    z-index: 1;
}

/* 右上角 Logo */
.kd-logo-right-section {
    position: absolute;
    top: 50px;
    right: 60px;
    height: 54px;
    z-index: 10;
}

/* 章节内容层 - 左上角定位 */
.kd-section-content {
    position: absolute;
    top: 80px;
    left: 80px;
    z-index: 5;
}

/* 章节序号 - 125磅，天蓝色 #00CCFE */
.kd-section-number {
    font-size: 125pt;
    font-weight: 700;
    color: #00CCFE;             /* 天蓝色 */
    line-height: 1;
}

/* 短横线 - 天蓝色 */
.kd-section-divider {
    width: 6em;
    height: 8px;
    background: #00CCFE;
    margin: 20px 0;
}

/* 章节标题 - 24磅，白色 */
.kd-section-title {
    font-size: 24pt;
    font-weight: 700;
    color: #FFFFFF;
    line-height: 1.3;
}

/* ⭐ 版权信息 - 左下角，9.4磅，白色 */
.kd-copyright {
    position: absolute;
    bottom: 20px;
    left: 60px;
    font-size: 9.4pt;
    color: #FFFFFF;
    letter-spacing: 0.5px;
    z-index: 10;
}

/* ⭐ 保密标识 - 右下角，9.4磅，白色 */
.kd-confidential {
    position: absolute;
    bottom: 20px;
    right: 60px;
    font-size: 9.4pt;
    color: #FFFFFF;
    letter-spacing: 0.5px;
    z-index: 10;
}
```

### 章节页布局示例

```html
<section class="slide slide-section">
    <img class="kd-section-image" src="https://static.yunzhijia.com/home/download/png/kingdee_chapter.png" alt="章节背景">
    <img class="kd-logo-right-section" src="https://static.yunzhijia.com/home/download/png/cloudhub_white.png" alt="Cloudhub 云之家 Logo">
    <div class="kd-section-content">
        <div class="kd-section-number kd-reveal">01</div>
        <div class="kd-section-divider kd-reveal"></div>
        <h2 class="kd-section-title kd-reveal">本周项目全景图</h2>
    </div>
    <!-- ⭐ 版权信息 - 左下角，白色 -->
    <div class="kd-copyright">版权所有©2026 云之家网络（重庆）有限公司</div>
    <!-- ⭐ 保密标识 - 右下角，白色 -->
    <div class="kd-confidential">④内部公开 请勿外传</div>
</section>
```

### 5. 尾页 / Closing Slide（Cloudhub 专属）

```css
.kd-slide-closing {
    background: var(--bg-white);
    position: relative;
    height: 100vh;
}

/* ⭐ Cloudhub 专属：全屏背景图 */
.ch-closing-bg {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    z-index: 1;
}

/* 左上角 Logo - 使用白色Logo */
.kd-logo-left-closing {
    position: absolute;
    top: 40px;
    left: 60px;
    height: 40px;
    z-index: 10;
}

/* ⭐ Cloudhub 专属：右上角 Slogan 图 - 与首页位置相同 */
.ch-closing-slogan {
    position: absolute;
    top: 40px;
    right: 60px;
    height: 48px;
    z-index: 10;
}

/* ⭐ Cloudhub 专属：左侧感谢图 - 垂直居中 */
.ch-closing-thanks {
    position: absolute;
    top: 50%;
    left: 10%;
    transform: translateY(-50%);
    max-height: 35%;
    width: auto;
    object-fit: contain;
    z-index: 5;
}

/* ⭐ 版权信息 - 左下角，9.4磅，白色 */
.kd-copyright {
    position: absolute;
    bottom: 20px;
    left: 60px;
    font-size: 9.4pt;
    color: #FFFFFF;
    letter-spacing: 0.5px;
    z-index: 10;
}

/* ⭐ 保密标识 - 右下角，9.4磅，白色 */
.kd-confidential {
    position: absolute;
    bottom: 20px;
    right: 60px;
    font-size: 9.4pt;
    color: #FFFFFF;
    letter-spacing: 0.5px;
    z-index: 10;
}
```

**尾页不添加额外文字内容**，仅展示装饰图片。Cloudhub 尾页使用全屏背景图 + 左右两侧装饰图。

#### 尾页布局示例（Cloudhub 专属）

```html
<section class="slide slide-closing">
    <!-- ⭐ 全屏背景图 -->
    <img class="ch-closing-bg" src="https://static.yunzhijia.com/home/download/png/cloudhub_endpage.png" alt="尾页全屏背景">
    <!-- 左上角 Logo - 白色Logo -->
    <img class="kd-logo-left-closing" src="https://static.yunzhijia.com/home/download/png/cloudhub_white.png" alt="Cloudhub 云之家 Logo">
    <!-- ⭐ 右上角 Slogan 图 - 与首页位置相同 -->
    <img class="ch-closing-slogan" src="https://static.yunzhijia.com/home/download/png/Cloudhub_slogan2025.png" alt="云之家 Slogan">
    <!-- ⭐ 左侧感谢图 -->
    <img class="ch-closing-thanks" src="https://static.yunzhijia.com/home/download/png/cloudhub_thanks.png" alt="感谢">
    <!-- ⭐ 版权信息 - 左下角，白色 -->
    <div class="kd-copyright">版权所有©2026 云之家网络（重庆）有限公司</div>
    <!-- ⭐ 保密标识 - 右下角，白色 -->
    <div class="kd-confidential">④内部公开 请勿外传</div>
</section>
```

---

## Animation / 动画

```css
/* 专业简洁的入场动画 */
.kd-reveal {
    opacity: 0;
    transform: translateY(20px);
    transition: opacity 0.5s ease, transform 0.5s ease;
}

.slide.visible .kd-reveal { opacity: 1; transform: translateY(0); }

/* 尊重减少动画偏好 */
@media (prefers-reduced-motion: reduce) {
    .kd-reveal { transition: none; opacity: 1; transform: none; }
}
```

---

## Signature Elements / 签名视觉元素

1. **品牌蓝背景** — 章节页使用蓝色底
2. **Cloudhub Logo** — 首页左上角 `cloudhub_white.png`，目录页/章节页右上角 `cloudhub_blue.png`，内容页 `cloudhub_blue.png`，尾页左上角 `cloudhub_white.png`
3. **⭐ 首页右上角 Slogan** — `Cloudhub_slogan2025.png`（Cloudhub 专属）
4. **首页全屏背景图** — `cloudhub_homepage.png` 全屏显示
5. **首页标题样式** — 白色54磅，居中，**单行显示（不换行）**
6. **首页底部信息** — 只显示人名（无"汇报人："前缀）+ 日期（白色18磅，**左移5%定位**）
7. **白色内容页** — 干净专业，突出内容
8. **统一字体规范** — 微软雅黑，与 Kingdee 一致
9. **标题与Logo对齐** — 内容页标题位置上移至top:50px，与右上角Logo齐平
10. **目录页全屏背景** — `kingdee_catalogue.png` 全屏平铺
11. **⭐ 尾页全屏背景 + 双装饰图** — `cloudhub_endpage.png` 全屏背景 + `Cloudhub_slogan2025.png` 右上角 + `cloudhub_thanks.png` 左侧（Cloudhub 专属）
12. **⭐ 版权信息** — 所有页面左下角，9.4磅，首页/章节页/尾页白色，目录页/内容页灰色（#808080）
13. **⭐ 保密标识** — 所有页面右下角，9.4磅，首页/章节页/尾页白色，目录页/内容页灰色（#808080），默认"④内部公开 请勿外传"

---

## Page Type Checklist / 页面类型检查

| 页面类型 | 背景 | Logo 位置 | 特殊元素 | 版权/保密颜色 |
|---------|------|----------|---------|-------------|
| 首页 | 全屏背景图 cloudhub_homepage.png | 左上角 cloudhub_white.png（高度48px） | **右上角 Slogan 图（高度48px）**；标题白色54磅居中**单行显示**；底部人名（无前缀）+日期白色18磅**左移5%** | 白色 |
| 目录页 | 白色 | 右上角 cloudhub_blue.png（高度54px） | 全屏背景 kingdee_catalogue.png；标题"目 录"24磅；序号蓝色**54磅（条数>5时40磅）**；页码蓝色20磅 | 灰色 #808080 |
| 章节页 | 蓝色 + 全屏背景图 | 右上角 cloudhub_white.png（高度54px） | 全屏背景 kingdee_chapter.png；序号125pt天蓝色；标题24pt白色 | 白色 |
| 内容页 | 白色 | 右上角 cloudhub_blue.png（高度54px） | 标题22pt；正文12pt | 灰色 #808080 |
| 尾页 | 白色 | 左上角 cloudhub_white.png（高度40px） | ⭐ 全屏背景 cloudhub_endpage.png；右上角 Slogan + 左侧感谢图 | 白色 |

**所有页面必须包含：**
- 左下角版权信息：`版权所有©2026 云之家网络（重庆）有限公司`（9.4磅）
- 右下角保密标识：默认 `④内部公开 请勿外传`（9.4磅）

---

## Best For / 适用场景

Cloudhub product demos · 云之家产品演示 · B2B presentations · 企业解决方案 · Corporate training

云之家产品演示 · 企业解决方案 · B2B 演示文稿 · 企业培训

---

## Assets / 资源文件

源文件位于 `themes/cloudhub/assets/` 目录：

### 文件用途速查表

| 文件 | 用途 | 页面 |
|-----|------|-----|
| `cloudhub_white.png` | Cloudhub Logo（白色背景用） | 首页左上角、章节页右上角、尾页左上角 |
| `cloudhub_blue.png` | Cloudhub Logo（蓝色背景专用） | 目录页/内容页 |
| `cloudhub_homepage.png` | 首页全屏背景图 | 首页 |
| `Cloudhub_slogan2025.png` | ⭐ Slogan 图（Cloudhub 专属） | 首页右上角、尾页右上角 |
| `cloudhub_endpage.png` | ⭐ 尾页全屏背景图 | 尾页（Cloudhub 专属） |
| `cloudhub_thanks.png` | ⭐ 感谢图（Cloudhub 专属） | 尾页左侧 |
| `kingdee_catalogue.png` | 目录页全屏背景图 | 目录页（继承 Kingdee） |
| `kingdee_chapter.png` | 章节页全屏背景图 | 章节页（继承 Kingdee） |

---

## ⭐ 页面底部统一元素（所有页面）

### 版权信息（左下角）

- **位置**：`left: 60px; bottom: 20px`
- **字体**：9.4磅，微软雅黑
- **内容**：`版权所有©2026 云之家网络（重庆）有限公司`
- **颜色规则**：
  - 首页、章节页、尾页：白色 `#FFFFFF`
  - 目录页、内容页：灰色 `#808080`

### 保密标识（右下角）

- **位置**：`right: 60px; bottom: 20px`
- **字体**：9.4磅，微软雅黑
- **颜色规则**：
  - 首页、章节页、尾页：白色 `#FFFFFF`
  - 目录页、内容页：灰色 `#808080`

- **保密级别选项**（根据序号或关键词选择）：

| 序号 | 关键词 | 显示文本 |
|-----|-------|---------|
| 1 | 绝密 | ①绝密信息 严禁泄露 |
| 2 | 机密 | ②机密信息 严禁泄露 |
| 3 | 秘密 | ③秘密信息 严禁泄露 |
| 4 | 内部（默认） | ④内部公开 请勿外传 |

### ⭐ 版权与保密信息规范

**所有页面必须添加以下两个元素：**

| 元素 | 位置 | 字号 | 内容 |
|-----|-----|-----|-----|
| 版权信息 | 左下角 | 9.4磅 | 版权所有©2026 云之家网络（重庆）有限公司 |
| 保密标识 | 右下角 | 9.4磅 | 根据级别选择（默认：④内部公开 请勿外传） |

**颜色规则：**
- 首页、章节页、尾页：白色（#FFFFFF）
- 目录页、内容页：灰色（#808080）

**保密级别选项：**

| 序号 | 关键词 | 显示文本 |
|-----|-------|---------|
| 1 | 绝密 | ①绝密信息 严禁泄露 |
| 2 | 机密 | ②机密信息 严禁泄露 |
| 3 | 秘密 | ③秘密信息 严禁泄露 |
| 4 | 内部（默认） | ④内部公开 请勿外传 |

### alt 属性规范

```html
<!-- Logo 系列 -->
alt="Cloudhub 云之家 Logo"
alt="Cloudhub 云之家 Logo（蓝底用）"

<!-- Slogan -->
alt="云之家 Slogan"

<!-- 装饰系列 -->
alt="首页全屏背景"
alt="目录页背景"
alt="章节页背景"
alt="尾页全屏背景"
alt="感谢"
```

---

## CDN Links / CDN 链接

图片已部署到 Cloudflare Pages CDN：

| 文件 | CDN 链接 |
|-----|---------|
| cloudhub_white.png | https://static.yunzhijia.com/home/download/png/cloudhub_white.png |
| cloudhub_blue.png | https://static.yunzhijia.com/home/download/png/cloudhub_blue.png |
| cloudhub_homepage.png | https://static.yunzhijia.com/home/download/png/cloudhub_homepage.png |
| Cloudhub_slogan2025.png | https://static.yunzhijia.com/home/download/png/Cloudhub_slogan2025.png |
| cloudhub_endpage.png | https://static.yunzhijia.com/home/download/png/cloudhub_endpage.png |
| cloudhub_thanks.png | https://static.yunzhijia.com/home/download/png/cloudhub_thanks.png |
| kingdee_catalogue.png | https://static.yunzhijia.com/home/download/png/kingdee_catalogue.png |
| kingdee_chapter.png | https://static.yunzhijia.com/home/download/png/kingdee_chapter.png |
