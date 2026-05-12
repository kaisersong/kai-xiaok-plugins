export interface ListThemesOutput {
    themes: Array<{
        name: string;
        description: string;
        palette: 'light' | 'dark';
        recommended_for: string[];
    }>;
}
export declare function handleListThemes(): ListThemesOutput;
