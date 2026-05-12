export interface ThemeCSS {
    name: string;
    themeCSS: string;
    sharedCSS: string;
}
export declare function loadTheme(themeName: string): ThemeCSS;
/**
 * Assemble final CSS: theme-base → shared → theme-post-shared → optional overrides.
 * Themes may include a "POST-SHARED OVERRIDE" section (marked by a comment
 * starting with "/* === POST-SHARED OVERRIDE") that needs to come AFTER
 * shared.css so it can override component styles.
 */
export declare function assembleCSS(theme: ThemeCSS, overrides?: Record<string, string>): string;
export declare function getBuiltinThemes(): string[];
