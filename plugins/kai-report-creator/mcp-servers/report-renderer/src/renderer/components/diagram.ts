import type { IRBlock } from '../../parser/ir-parser.js';
import type { RenderOptions } from '../types.js';
import { escHtml } from '../escape.js';

/**
 * Render a :::diagram block into inline SVG.
 * Supports: sequence, flowchart, tree, mindmap
 */
export function renderDiagram(block: IRBlock, options: RenderOptions): string {
  const type = block.params['type'] ?? 'flowchart';
  const animClass = options.animations ? ' fade-in-up' : '';

  let svg: string;
  switch (type) {
    case 'sequence':
      svg = renderSequenceDiagram(block.body);
      break;
    case 'flowchart':
      svg = renderFlowchartDiagram(block.body);
      break;
    case 'tree':
      svg = renderTreeDiagram(block.body);
      break;
    case 'mindmap':
      svg = renderMindmapDiagram(block.body);
      break;
    default:
      svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 100"><text x="20" y="50" font-size="14">Unsupported diagram type: ${escHtml(type)}</text></svg>`;
  }

  return `          <div data-component="diagram" data-type="${type}" class="diagram-wrapper${animClass}">
            ${svg}
          </div>`;
}

function renderSequenceDiagram(body: string): string {
  const lines = body.trim().split('\n');
  let actors: string[] = [];
  const steps: Array<{ from: string; to: string; msg: string }> = [];

  let inSteps = false;
  let current: { from?: string; to?: string; msg?: string } | null = null;

  const flushStep = () => {
    if (current && current.from && current.to && current.msg) {
      steps.push({ from: current.from, to: current.to, msg: current.msg });
    }
    current = null;
  };

  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    const actorMatch = t.match(/^actors:\s*\[(.+)\]$/);
    if (actorMatch) {
      actors = actorMatch[1]!.split(',').map(s => s.trim());
      continue;
    }
    if (t === 'steps:') { inSteps = true; continue; }
    if (!inSteps) continue;

    // New item starts with "- "
    if (t.startsWith('- ')) {
      flushStep();
      current = {};
      // Parse inline fields on the same line as "-"
      const rest = t.slice(2);
      const fromM = rest.match(/from:\s*(\S+)/);
      const toM = rest.match(/to:\s*(\S+)/);
      const msgM = rest.match(/msg:\s*(.+?)(?:,\s*(?:from|to):|\s*$)/);
      if (fromM) current.from = fromM[1]!;
      if (toM) current.to = toM[1]!;
      if (msgM) current.msg = msgM[1]!.trim().replace(/,\s*$/, '');
    } else if (current) {
      // Continuation line for current item
      const fromM = t.match(/^from:\s*(.+?)(?:,|$)/);
      const toM = t.match(/^to:\s*(.+?)(?:,|$)/);
      const msgM = t.match(/^msg:\s*(.+?)(?:,|$)/);
      if (fromM) current.from = fromM[1]!.trim();
      if (toM) current.to = toM[1]!.trim();
      if (msgM) current.msg = msgM[1]!.trim();
    }
  }
  flushStep();

  if (actors.length === 0) return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50"><text x="10" y="25">No actors</text></svg>';

  const actorSpacing = 180;
  const width = actorSpacing * actors.length;
  const height = 80 + 50 * steps.length + 30;

  const actorIndex = new Map(actors.map((a, i) => [a, i]));
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" style="max-width:100%">`;
  svg += '<style>text{font-family:sans-serif;font-size:12px} .actor-label{font-weight:bold;font-size:13px} .msg{font-size:11px;fill:#555}</style>';

  // Draw actors
  actors.forEach((actor, i) => {
    const x = i * actorSpacing + 90;
    svg += `<rect x="${x - 40}" y="10" width="80" height="30" fill="#e8f0fe" stroke="#4285f4" rx="4"/>`;
    svg += `<text x="${x}" y="30" text-anchor="middle" class="actor-label">${escHtml(actor)}</text>`;
    svg += `<line x1="${x}" y1="40" x2="${x}" y2="${height - 30}" stroke="#ccc" stroke-dasharray="4"/>`;
  });

  // Draw steps
  steps.forEach((step, i) => {
    const fromIdx = actorIndex.get(step.from) ?? 0;
    const toIdx = actorIndex.get(step.to) ?? 1;
    const x1 = fromIdx * actorSpacing + 90;
    const x2 = toIdx * actorSpacing + 90;
    const y = 80 + i * 50;
    const dir = x2 > x1 ? 1 : -1;
    svg += `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="#333" marker-end="url(#arrow)"/>`;
    svg += `<text x="${(x1 + x2) / 2}" y="${y - 8}" text-anchor="middle" class="msg">${escHtml(step.msg)}</text>`;
  });

  // Arrow marker
  svg += '<defs><marker id="arrow" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#333"/></marker></defs>';
  svg += '</svg>';
  return svg;
}

function renderFlowchartDiagram(body: string): string {
  const lines = body.trim().split('\n');
  const nodes: Array<{ id: string; kind: string; label: string }> = [];
  const edges: Array<{ from: string; to: string; label?: string }> = [];

  let section: 'none' | 'nodes' | 'edges' = 'none';
  let curNode: { id?: string; kind?: string; label?: string } | null = null;
  let curEdge: { from?: string; to?: string; label?: string } | null = null;

  const flushNode = () => {
    if (curNode && curNode.id && curNode.label) {
      nodes.push({ id: curNode.id, kind: curNode.kind ?? 'rect', label: curNode.label });
    }
    curNode = null;
  };
  const flushEdge = () => {
    if (curEdge && curEdge.from && curEdge.to) {
      edges.push({ from: curEdge.from, to: curEdge.to, label: curEdge.label });
    }
    curEdge = null;
  };

  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (t === 'nodes:') { flushNode(); flushEdge(); section = 'nodes'; continue; }
    if (t === 'edges:') { flushNode(); flushEdge(); section = 'edges'; continue; }

    if (section === 'nodes') {
      if (t.startsWith('- ')) {
        flushNode();
        curNode = {};
        const rest = t.slice(2);
        const idM = rest.match(/id:\s*(\w+)/);
        const kindM = rest.match(/kind:\s*(\w+)/);
        const labelM = rest.match(/label:\s*(.+?)(?:,\s*(?:id|kind):|\s*$)/);
        if (idM) curNode.id = idM[1]!;
        if (kindM) curNode.kind = kindM[1]!;
        if (labelM) curNode.label = labelM[1]!.trim().replace(/,\s*$/, '');
      } else if (curNode) {
        const idM = t.match(/^id:\s*(.+?)(?:,|$)/);
        const kindM = t.match(/^kind:\s*(.+?)(?:,|$)/);
        const labelM = t.match(/^label:\s*(.+?)(?:,|$)/);
        if (idM) curNode.id = idM[1]!.trim();
        if (kindM) curNode.kind = kindM[1]!.trim();
        if (labelM) curNode.label = labelM[1]!.trim();
      }
    }

    if (section === 'edges') {
      if (t.startsWith('- ')) {
        flushEdge();
        curEdge = {};
        const rest = t.slice(2);
        const fromM = rest.match(/from:\s*(\w+)/);
        const toM = rest.match(/to:\s*(\w+)/);
        const labelM = rest.match(/label:\s*(.+?)(?:,\s*(?:from|to):|\s*$)/);
        if (fromM) curEdge.from = fromM[1]!;
        if (toM) curEdge.to = toM[1]!;
        if (labelM) curEdge.label = labelM[1]!.trim().replace(/,\s*$/, '');
      } else if (curEdge) {
        const fromM = t.match(/^from:\s*(.+?)(?:,|$)/);
        const toM = t.match(/^to:\s*(.+?)(?:,|$)/);
        const labelM = t.match(/^label:\s*(.+?)(?:,|$)/);
        if (fromM) curEdge.from = fromM[1]!.trim();
        if (toM) curEdge.to = toM[1]!.trim();
        if (labelM) curEdge.label = labelM[1]!.trim();
      }
    }
  }
  flushNode();
  flushEdge();

  const width = 600;
  const nodeHeight = 50;
  const spacing = 100;
  const height = Math.max(120 * nodes.length, 200) + 30;
  const nodePositions = new Map<string, { x: number; y: number }>();

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" style="max-width:100%">`;
  svg += '<style>text{font-family:sans-serif;font-size:12px} .node-label{font-size:11px}</style>';
  svg += '<defs><marker id="fc-arrow" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#333"/></marker></defs>';

  // Position nodes vertically centered
  nodes.forEach((node, i) => {
    const x = width / 2;
    const y = 40 + i * spacing;
    nodePositions.set(node.id, { x, y });

    if (node.kind === 'diamond') {
      svg += `<polygon points="${x},${y - 25} ${x + 50},${y} ${x},${y + 25} ${x - 50},${y}" fill="#fff3cd" stroke="#ffc107"/>`;
    } else if (node.kind === 'circle') {
      svg += `<ellipse cx="${x}" cy="${y}" rx="50" ry="20" fill="#d4edda" stroke="#28a745"/>`;
    } else {
      svg += `<rect x="${x - 60}" y="${y - 20}" width="120" height="40" fill="#e8f0fe" stroke="#4285f4" rx="4"/>`;
    }
    svg += `<text x="${x}" y="${y + 4}" text-anchor="middle" class="node-label">${escHtml(node.label)}</text>`;
  });

  // Draw edges
  edges.forEach(edge => {
    const from = nodePositions.get(edge.from);
    const to = nodePositions.get(edge.to);
    if (!from || !to) return;
    const y1 = from.y + 25;
    const y2 = to.y - 25;
    svg += `<line x1="${from.x}" y1="${y1}" x2="${to.x}" y2="${y2}" stroke="#333" marker-end="url(#fc-arrow)"/>`;
    if (edge.label) {
      svg += `<text x="${(from.x + to.x) / 2 + 5}" y="${(y1 + y2) / 2}" font-size="10" fill="#666">${escHtml(edge.label)}</text>`;
    }
  });

  svg += '</svg>';
  return svg;
}

function renderTreeDiagram(body: string): string {
  // Simplified tree: parse root + children
  const lines = body.trim().split('\n');
  let root = '';
  const children: Array<{ name: string; sub: string[] }> = [];

  let currentBranch: { name: string; sub: string[] } | null = null;
  for (const line of lines) {
    const t = line.trim();
    const rootMatch = t.match(/^root:\s*(.+)$/);
    if (rootMatch) { root = rootMatch[1]!.trim(); continue; }
    if (t === 'children:') continue;

    // Top-level child: "- name: X"
    const childMatch = t.match(/^-\s*(?:name:\s*)?(.+)$/);
    if (childMatch && !line.startsWith('    ')) {
      if (currentBranch) children.push(currentBranch);
      currentBranch = { name: childMatch[1]!.trim(), sub: [] };
    } else if (childMatch && line.startsWith('    ') && currentBranch) {
      currentBranch.sub.push(childMatch[1]!.trim());
    }
  }
  if (currentBranch) children.push(currentBranch);

  const width = Math.max(200 * children.length, 400);
  const height = 200 + 30;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" style="max-width:100%">`;
  svg += '<style>text{font-family:sans-serif;font-size:11px}</style>';

  // Root
  const rootX = width / 2;
  svg += `<rect x="${rootX - 50}" y="20" width="100" height="30" fill="#e8f0fe" stroke="#4285f4" rx="4"/>`;
  svg += `<text x="${rootX}" y="40" text-anchor="middle" font-weight="bold">${escHtml(root || 'Root')}</text>`;

  // Children
  const spacing = width / (children.length + 1);
  children.forEach((child, i) => {
    const cx = spacing * (i + 1);
    const cy = 100;
    svg += `<line x1="${rootX}" y1="50" x2="${cx}" y2="${cy - 15}" stroke="#999"/>`;
    svg += `<rect x="${cx - 45}" y="${cy - 15}" width="90" height="28" fill="#f0f0f0" stroke="#666" rx="3"/>`;
    svg += `<text x="${cx}" y="${cy + 3}" text-anchor="middle">${escHtml(child.name)}</text>`;

    // Sub-children
    child.sub.forEach((sub, j) => {
      const sy = cy + 50 + j * 30;
      svg += `<line x1="${cx}" y1="${cy + 13}" x2="${cx}" y2="${sy - 8}" stroke="#ccc"/>`;
      svg += `<text x="${cx}" y="${sy + 4}" text-anchor="middle" font-size="10" fill="#555">${escHtml(sub)}</text>`;
    });
  });

  svg += '</svg>';
  return svg;
}

function renderMindmapDiagram(body: string): string {
  const lines = body.trim().split('\n');
  let center = '';
  const branches: Array<{ name: string; items: string[] }> = [];

  let currentBranch: { name: string; items: string[] } | null = null;
  for (const line of lines) {
    const t = line.trim();
    const centerMatch = t.match(/^center:\s*(.+)$/);
    if (centerMatch) { center = centerMatch[1]!.trim(); continue; }
    if (t === 'branches:') continue;

    const nameMatch = t.match(/^-\s*name:\s*(.+)$/);
    if (nameMatch && !line.startsWith('      ')) {
      if (currentBranch) branches.push(currentBranch);
      currentBranch = { name: nameMatch[1]!.trim(), items: [] };
      continue;
    }

    if (t.startsWith('items:') && currentBranch) continue;
    const itemMatch = t.match(/^-\s*(.+)$/);
    if (itemMatch && currentBranch && line.startsWith('      ')) {
      currentBranch.items.push(itemMatch[1]!.trim());
    }
  }
  if (currentBranch) branches.push(currentBranch);

  const width = 700;
  const height = 500;
  const cx = width / 2;
  const cy = height / 2;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height + 30}" style="max-width:100%">`;
  svg += '<style>text{font-family:sans-serif;font-size:11px}</style>';

  // Center node
  svg += `<ellipse cx="${cx}" cy="${cy}" rx="60" ry="25" fill="#4285f4" stroke="#1a56db"/>`;
  svg += `<text x="${cx}" y="${cy + 4}" text-anchor="middle" fill="white" font-weight="bold" font-size="12">${escHtml(center || 'Center')}</text>`;

  // Branches in radial layout
  const angleStep = (2 * Math.PI) / Math.max(branches.length, 1);
  branches.forEach((branch, i) => {
    const angle = angleStep * i - Math.PI / 2;
    const bx = cx + Math.cos(angle) * 160;
    const by = cy + Math.sin(angle) * 120;
    svg += `<line x1="${cx}" y1="${cy}" x2="${bx}" y2="${by}" stroke="#999" stroke-width="1.5"/>`;
    svg += `<ellipse cx="${bx}" cy="${by}" rx="50" ry="18" fill="#e8f0fe" stroke="#4285f4"/>`;
    svg += `<text x="${bx}" y="${by + 4}" text-anchor="middle" font-size="10">${escHtml(branch.name)}</text>`;

    // Items
    branch.items.forEach((item, j) => {
      const itemAngle = angle + (j - (branch.items.length - 1) / 2) * 0.3;
      const ix = bx + Math.cos(itemAngle) * 80;
      const iy = by + Math.sin(itemAngle) * 50;
      svg += `<line x1="${bx}" y1="${by}" x2="${ix}" y2="${iy}" stroke="#ccc"/>`;
      svg += `<text x="${ix}" y="${iy + 3}" text-anchor="middle" font-size="9" fill="#555">${escHtml(item)}</text>`;
    });
  });

  svg += '</svg>';
  return svg;
}

