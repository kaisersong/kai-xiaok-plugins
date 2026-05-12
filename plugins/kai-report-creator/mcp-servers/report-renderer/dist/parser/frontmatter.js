import yaml from 'js-yaml';
const VALID_THEMES = [
    'corporate-blue', 'minimal', 'dark-tech',
    'dark-board', 'data-story', 'newspaper',
];
const VALID_REPORT_CLASSES = ['narrative', 'mixed', 'data'];
const VALID_ARCHETYPES = ['brief', 'research', 'comparison', 'update'];
export function parseFrontmatter(source) {
    const lines = source.split('\n');
    const warnings = [];
    // Find opening ---
    let start = -1;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim() === '---') {
            start = i;
            break;
        }
        // Skip leading blank lines
        if (lines[i].trim() !== '') {
            warnings.push('Content before frontmatter opening ---');
            break;
        }
    }
    if (start === -1) {
        return {
            frontmatter: defaultFrontmatter(),
            warnings: ['No frontmatter found (missing opening ---)'],
            bodyStart: 0,
        };
    }
    // Find closing ---
    let end = -1;
    for (let i = start + 1; i < lines.length; i++) {
        if (lines[i].trim() === '---') {
            end = i;
            break;
        }
    }
    if (end === -1) {
        return {
            frontmatter: defaultFrontmatter(),
            warnings: ['Unclosed frontmatter (missing closing ---)'],
            bodyStart: start + 1,
        };
    }
    const yamlContent = lines.slice(start + 1, end).join('\n');
    let parsed;
    try {
        parsed = yaml.load(yamlContent) ?? {};
    }
    catch (e) {
        return {
            frontmatter: defaultFrontmatter(),
            warnings: [`YAML parse error: ${e.message}`],
            bodyStart: end + 1,
        };
    }
    const fm = {
        title: str(parsed['title'], ''),
        theme: str(parsed['theme'], 'corporate-blue'),
        date: str(parsed['date'], new Date().toISOString().slice(0, 10)),
        lang: str(parsed['lang'], 'zh'),
        report_class: str(parsed['report_class'], 'mixed'),
    };
    // Optional fields
    if (parsed['archetype'])
        fm.archetype = str(parsed['archetype'], '');
    if (parsed['audience'])
        fm.audience = str(parsed['audience'], '');
    if (parsed['decision_goal'])
        fm.decision_goal = str(parsed['decision_goal'], '');
    if (parsed['must_include'])
        fm.must_include = toStringArray(parsed['must_include']);
    if (parsed['must_avoid'])
        fm.must_avoid = toStringArray(parsed['must_avoid']);
    if (parsed['charts'])
        fm.charts = str(parsed['charts'], 'cdn');
    if (parsed['toc'] !== undefined)
        fm.toc = Boolean(parsed['toc']);
    if (parsed['animations'] !== undefined)
        fm.animations = Boolean(parsed['animations']);
    if (parsed['abstract'])
        fm.abstract = str(parsed['abstract'], '');
    if (parsed['author'])
        fm.author = str(parsed['author'], '');
    if (parsed['poster_title'])
        fm.poster_title = str(parsed['poster_title'], '');
    if (parsed['poster_subtitle'])
        fm.poster_subtitle = str(parsed['poster_subtitle'], '');
    if (parsed['poster_note'])
        fm.poster_note = str(parsed['poster_note'], '');
    if (parsed['template'])
        fm.template = str(parsed['template'], '');
    if (parsed['theme_overrides'] && typeof parsed['theme_overrides'] === 'object') {
        fm.theme_overrides = parsed['theme_overrides'];
    }
    if (parsed['custom_blocks'] && typeof parsed['custom_blocks'] === 'object') {
        fm.custom_blocks = parsed['custom_blocks'];
    }
    // Validate
    if (!fm.title)
        warnings.push('Missing required field: title');
    if (!VALID_THEMES.includes(fm.theme) && !fm.theme.startsWith('custom-')) {
        warnings.push(`Unknown theme "${fm.theme}", expected one of: ${VALID_THEMES.join(', ')}`);
    }
    if (!VALID_REPORT_CLASSES.includes(fm.report_class)) {
        warnings.push(`Invalid report_class "${fm.report_class}", expected: ${VALID_REPORT_CLASSES.join(', ')}`);
    }
    if (fm.archetype && !VALID_ARCHETYPES.includes(fm.archetype)) {
        warnings.push(`Invalid archetype "${fm.archetype}", expected: ${VALID_ARCHETYPES.join(', ')}`);
    }
    return { frontmatter: fm, warnings, bodyStart: end + 1 };
}
function defaultFrontmatter() {
    return {
        title: '',
        theme: 'corporate-blue',
        date: new Date().toISOString().slice(0, 10),
        lang: 'zh',
        report_class: 'mixed',
    };
}
function str(val, fallback) {
    if (val === null || val === undefined)
        return fallback;
    if (val instanceof Date) {
        // js-yaml parses bare dates like 2025-11-24 into Date objects
        const y = val.getFullYear();
        const m = String(val.getMonth() + 1).padStart(2, '0');
        const d = String(val.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
    return String(val);
}
function toStringArray(val) {
    if (Array.isArray(val))
        return val.map(v => String(v));
    if (typeof val === 'string')
        return [val];
    return [];
}
//# sourceMappingURL=frontmatter.js.map