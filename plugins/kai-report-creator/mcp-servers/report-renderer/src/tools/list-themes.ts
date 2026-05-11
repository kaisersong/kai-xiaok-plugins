export interface ListThemesOutput {
  themes: Array<{
    name: string;
    description: string;
    palette: 'light' | 'dark';
    recommended_for: string[];
  }>;
}

export function handleListThemes(): ListThemesOutput {
  return {
    themes: [
      {
        name: 'corporate-blue',
        description: '商业/高管汇报风格，墨绿金色调，温暖专业',
        palette: 'light',
        recommended_for: ['quarterly report', 'executive summary', 'business review'],
      },
      {
        name: 'minimal',
        description: '学术/研究风格，衬线体，清爽简洁',
        palette: 'light',
        recommended_for: ['research paper', 'white paper', 'academic report'],
      },
      {
        name: 'dark-tech',
        description: '技术文档风格，暗色紫蓝，现代科技感',
        palette: 'dark',
        recommended_for: ['technical doc', 'API report', 'engineering review'],
      },
      {
        name: 'dark-board',
        description: '看板/架构风格，暗色 GitHub 风格',
        palette: 'dark',
        recommended_for: ['dashboard', 'architecture overview', 'ops report'],
      },
      {
        name: 'data-story',
        description: '数据叙事风格，渐变红色调，适合数据驱动报告',
        palette: 'light',
        recommended_for: ['data analysis', 'growth report', 'metrics review'],
      },
      {
        name: 'newspaper',
        description: '编辑/新闻风格，印刷排版感',
        palette: 'light',
        recommended_for: ['newsletter', 'editorial', 'weekly digest'],
      },
    ],
  };
}
