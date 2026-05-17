import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const cssDir = join(__dirname, 'css');
const BUILTIN_THEMES = [
    'corporate-blue', 'minimal', 'dark-tech',
    'dark-board', 'data-story', 'newspaper',
    'regular-lumen', 'fangsong',
];
const cache = new Map();
export function loadTheme(themeName) {
    if (cache.has(themeName))
        return cache.get(themeName);
    const name = BUILTIN_THEMES.includes(themeName) ? themeName : 'corporate-blue';
    const themeCSS = readFileSync(join(cssDir, `${name}.css`), 'utf-8');
    const sharedCSS = readFileSync(join(cssDir, 'shared.css'), 'utf-8');
    const result = { name, themeCSS, sharedCSS };
    cache.set(themeName, result);
    return result;
}
/**
 * Assemble final CSS: theme-base → shared → theme-post-shared → optional overrides.
 * Themes may include a "POST-SHARED OVERRIDE" section (marked by a comment
 * starting with "/* === POST-SHARED OVERRIDE") that needs to come AFTER
 * shared.css so it can override component styles.
 */
export function assembleCSS(theme, overrides) {
    const POST_SHARED_MARKER = '/* === POST-SHARED OVERRIDE';
    const markerIdx = theme.themeCSS.indexOf(POST_SHARED_MARKER);
    let themeBase;
    let themePost;
    if (markerIdx !== -1) {
        themeBase = theme.themeCSS.slice(0, markerIdx).trimEnd();
        themePost = theme.themeCSS.slice(markerIdx);
    }
    else {
        themeBase = theme.themeCSS;
        themePost = '';
    }
    let css = themeBase + '\n' + theme.sharedCSS;
    if (themePost)
        css += '\n' + themePost;
    if (overrides && Object.keys(overrides).length > 0) {
        const vars = Object.entries(overrides)
            .map(([k, v]) => `  ${k.startsWith('--') ? k : `--${k}`}: ${v};`)
            .join('\n');
        css += `\n:root {\n${vars}\n}\n`;
    }
    return css;
}
export function getBuiltinThemes() {
    return [...BUILTIN_THEMES];
}
//# sourceMappingURL=loader.js.map