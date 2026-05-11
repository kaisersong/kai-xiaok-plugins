import type { IRBlock } from '../../parser/ir-parser.js';
import type { RenderOptions } from '../types.js';

let chartCounter = 0;

/**
 * Render a :::chart block into HTML with ECharts initialization.
 * Supports: bar, line, pie, radar, scatter, funnel, sankey
 */
export function renderChart(block: IRBlock, options: RenderOptions): string {
  const chartType = block.params['type'] ?? 'bar';
  const chartId = `chart-${++chartCounter}-${Date.now().toString(36)}`;
  const animClass = options.animations ? ' fade-in-up' : '';
  const height = block.params['height'] ?? '300px';

  const echartsOption = buildEchartsOption(chartType, block.body, options);

  return `          <div data-component="chart" data-type="${chartType}" class="chart-container${animClass}">
            <div id="${chartId}" style="height:${height}"></div>
            <script>
              (function(){
                var chart = echarts.init(document.getElementById('${chartId}'));
                chart.setOption(${JSON.stringify(echartsOption, null, 2)});
                window.addEventListener('resize', function(){ chart.resize(); });
              })();
            </script>
          </div>`;
}

function buildEchartsOption(type: string, body: string, opts: RenderOptions): Record<string, unknown> {
  const data = parseChartBody(body);

  switch (type) {
    case 'bar':
    case 'line':
      return buildAxisChart(type, data, opts);
    case 'pie':
      return buildPieChart(data, opts);
    case 'radar':
      return buildRadarChart(data, opts);
    case 'scatter':
      return buildScatterChart(data, opts);
    case 'funnel':
      return buildFunnelChart(data, opts);
    case 'sankey':
      return buildSankeyChart(data, opts);
    default:
      return buildAxisChart('bar', data, opts);
  }
}

interface ChartData {
  labels: string[];
  datasets: Array<{ name: string; data: number[] }>;
  stages?: Array<{ label: string; value: number }>;
  nodes?: Array<{ name: string }>;
  links?: Array<{ source: string; target: string; value: number }>;
  points?: Array<{ name: string; data: number[][] }>;
}

function parseChartBody(body: string): ChartData {
  const result: ChartData = { labels: [], datasets: [] };
  const lines = body.trim().split('\n');

  let currentDataset: { name: string; data: number[] } | null = null;
  let currentStages: Array<{ label: string; value: number }> = [];
  let currentNodes: Array<{ name: string }> = [];
  let currentLinks: Array<{ source: string; target: string; value: number }> = [];
  let inDatasets = false;
  let inStages = false;
  let inNodes = false;
  let inLinks = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // labels: [a, b, c]
    const labelsMatch = trimmed.match(/^labels:\s*\[(.+)\]$/);
    if (labelsMatch) {
      result.labels = labelsMatch[1]!.split(',').map(s => s.trim());
      continue;
    }

    if (trimmed === 'datasets:') { inDatasets = true; inStages = false; inNodes = false; inLinks = false; continue; }
    if (trimmed === 'stages:') { inStages = true; inDatasets = false; inNodes = false; inLinks = false; continue; }
    if (trimmed === 'nodes:') { inNodes = true; inDatasets = false; inStages = false; inLinks = false; continue; }
    if (trimmed === 'links:') { inLinks = true; inDatasets = false; inStages = false; inNodes = false; continue; }

    if (inDatasets) {
      const nameMatch = trimmed.match(/^-\s*name:\s*(.+)$/);
      if (nameMatch) {
        if (currentDataset) result.datasets.push(currentDataset);
        currentDataset = { name: nameMatch[1]!.trim(), data: [] };
        continue;
      }
      const dataMatch = trimmed.match(/^data:\s*\[(.+)\]$/);
      if (dataMatch && currentDataset) {
        currentDataset.data = dataMatch[1]!.split(',').map(s => parseFloat(s.trim()));
        continue;
      }
      const pointsMatch = trimmed.match(/^points:\s*\[(.+)\]$/);
      if (pointsMatch && currentDataset) {
        // scatter points: [[x,y], [x,y]]
        const raw = pointsMatch[1]!;
        const pairs = raw.match(/\[[\d.,\s]+\]/g) ?? [];
        currentDataset.data = []; // store in points instead
        if (!result.points) result.points = [];
        const pts = pairs.map(p => {
          const nums = p.replace(/[\[\]]/g, '').split(',').map(Number);
          return nums as number[];
        });
        result.points.push({ name: currentDataset.name, data: pts });
        continue;
      }
    }

    if (inStages) {
      const stageMatch = trimmed.match(/^-\s*(?:label:\s*)?(.+?)(?:,\s*value:\s*(\d+))?$/);
      if (stageMatch && trimmed.startsWith('-')) {
        const parts = trimmed.slice(1).trim();
        const labelVal = parts.match(/label:\s*(.+?)(?:,|$)/);
        const valueVal = parts.match(/value:\s*(\d+)/);
        if (labelVal && valueVal) {
          currentStages.push({ label: labelVal[1]!.trim(), value: parseInt(valueVal[1]!, 10) });
        }
      }
    }

    if (inNodes) {
      const nodeMatch = trimmed.match(/^-\s*(?:name:\s*)?(.+)$/);
      if (nodeMatch) currentNodes.push({ name: nodeMatch[1]!.trim() });
    }

    if (inLinks) {
      const sourceMatch = trimmed.match(/source:\s*(.+?)(?:,|$)/);
      const targetMatch = trimmed.match(/target:\s*(.+?)(?:,|$)/);
      const valueMatch = trimmed.match(/value:\s*(\d+)/);
      if (sourceMatch && targetMatch && valueMatch) {
        currentLinks.push({
          source: sourceMatch[1]!.trim(),
          target: targetMatch[1]!.trim(),
          value: parseInt(valueMatch[1]!, 10),
        });
      }
    }
  }

  if (currentDataset) result.datasets.push(currentDataset);
  if (currentStages.length > 0) result.stages = currentStages;
  if (currentNodes.length > 0) result.nodes = currentNodes;
  if (currentLinks.length > 0) result.links = currentLinks;

  return result;
}

function buildAxisChart(type: string, data: ChartData, _opts: RenderOptions): Record<string, unknown> {
  const hasLongLabels = data.labels.some(l => l.length > 4);
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: data.datasets.map(d => d.name) },
    grid: { left: '3%', right: '4%', bottom: hasLongLabels ? 60 : 30, containLabel: true },
    xAxis: {
      type: 'category',
      data: data.labels,
      axisLabel: hasLongLabels ? { rotate: 30 } : {},
    },
    yAxis: { type: 'value' },
    series: data.datasets.map(d => ({
      name: d.name,
      type,
      data: d.data,
      smooth: type === 'line',
    })),
  };
}

function buildPieChart(data: ChartData, _opts: RenderOptions): Record<string, unknown> {
  const pieData = data.labels.map((label, i) => ({
    name: label,
    value: data.datasets[0]?.data[i] ?? 0,
  }));
  return {
    tooltip: { trigger: 'item' },
    legend: { orient: 'vertical', left: 'left' },
    series: [{ type: 'pie', radius: '60%', data: pieData }],
  };
}

function buildRadarChart(data: ChartData, _opts: RenderOptions): Record<string, unknown> {
  const maxVal = Math.max(...data.datasets.flatMap(d => d.data));
  return {
    tooltip: {},
    legend: { data: data.datasets.map(d => d.name) },
    radar: {
      indicator: data.labels.map(l => ({ name: l, max: Math.ceil(maxVal * 1.2) })),
    },
    series: [{
      type: 'radar',
      data: data.datasets.map(d => ({ name: d.name, value: d.data })),
    }],
  };
}

function buildScatterChart(data: ChartData, _opts: RenderOptions): Record<string, unknown> {
  const series = (data.points ?? []).map(p => ({
    name: p.name,
    type: 'scatter',
    data: p.data,
  }));
  return {
    tooltip: { trigger: 'item' },
    xAxis: { type: 'value' },
    yAxis: { type: 'value' },
    series,
  };
}

function buildFunnelChart(data: ChartData, _opts: RenderOptions): Record<string, unknown> {
  return {
    tooltip: { trigger: 'item' },
    series: [{
      type: 'funnel',
      data: (data.stages ?? []).map(s => ({ name: s.label, value: s.value })),
      left: '10%',
      width: '80%',
    }],
  };
}

function buildSankeyChart(data: ChartData, _opts: RenderOptions): Record<string, unknown> {
  return {
    tooltip: { trigger: 'item' },
    series: [{
      type: 'sankey',
      data: (data.nodes ?? []).map(n => ({ name: n.name })),
      links: data.links ?? [],
      label: {
        formatter: '{b}',
      },
    }],
  };
}
