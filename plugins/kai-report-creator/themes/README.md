# Custom Themes

Place folders here to add your own themes to kai-report-creator.

## Directory Structure

```
themes/
  your-theme-name/
    reference.md   ← Style description (AI reads and generates CSS variables)
    theme.css      ← Direct CSS definitions (optional, takes priority over reference.md)
```

Both files are optional and can be used independently or together:

| Case | Behavior |
|------|----------|
| Only `reference.md` | AI reads style description and derives `:root` CSS variables |
| Only `theme.css` | CSS variables used directly, fully predictable output |
| Both present | `theme.css` takes priority; `reference.md` serves as style documentation |

## Usage

```bash
/report --theme your-theme-name "Report topic"
```

Or specify in `.report.md` frontmatter:

```yaml
theme: your-theme-name
```

## reference.md Format

```markdown
# Theme Name — Style Reference

One sentence description. Inspiration / aesthetic / mood.

---

## Colors

​```css
:root {
  --primary:      #...;   /* Main color: headings, links, accents */
  --bg:           #...;   /* Page background */
  --surface:      #...;   /* Card background */
  --text:         #...;   /* Body text */
  --text-muted:   #...;   /* Secondary text */
  --border:       #...;   /* Borders / dividers */
}
​```

## Typography

Font choices. Serif or sans-serif? Geometric or humanist? Google Fonts links.

## Layout

Whitespace style, card border-radius, max-width preferences.

## Best For

Brand reports, research docs, internal newsletters...
```

## theme.css Format

Define `:root` CSS variables to override the base theme defaults.

```css
:root {
  --primary:      #C2410C;
  --primary-light:#FFF7ED;
  --accent:       #EA580C;
  --bg:           #FFFBF7;
  --surface:      #FFFFFF;
  --text:         #1C1917;
  --text-muted:   #78716C;
  --border:       #E7E5E4;
  --font-sans:    'Inter', system-ui, sans-serif;
  --font-mono:    'JetBrains Mono', monospace;
  --radius:       6px;
}
```

See `templates/themes/corporate-blue.css` for all available variables.

## Notes

- Directories starting with `_` (e.g. `_example-warm-editorial`) are ignored and won't appear in theme lists
- Theme names support only letters, numbers, and hyphens: `my-brand`, `warm-editorial`
- Custom themes take priority over built-in themes with the same name

## Bundled: forest-editorial

`themes/forest-editorial/` — 米绿纸感编辑风: paper-green canvas (`#f5f7f3`),
generous 17–26px radii and soft long shadows. The identifying feature is the full-screen cover: forest-green field, gold
eyebrow rule, oversized headline with one phrase in `--cover-highlight`, and a
three-card conclusion strip pinned to the bottom. The rounded dark anchor block
still styles a title inside `.report-wrapper`, which is what custom `template:`
shells and the frozen skin fixture render.

```yaml
theme: forest-editorial
```

The theme green rides the `.kpi-card` top border, not the KPI number —
`shared.css` deliberately keeps `.kpi-value` neutral, and this theme respects
that. Chart colours (ECharts does not read CSS variables) are listed in the
`chart palette:` comment at the top of `theme.css`.

## Preset: radar-board (dark-board + one override)

An intelligence-dashboard flavour of `dark-board`. It is a **preset, not a
theme** — a frozen-fixture comparison showed the only difference from
`dark-board` is the accent colour, which is not worth a separate entry in the
theme table:

```yaml
theme: dark-board
theme_overrides:
  primary_color: "#5ee1b4"
```

Boundary: `theme_overrides` maps `primary_color` → `--primary` and
`font_family` → `--font-sans`, nothing else. Status tri-colour, background
tuning, mono KPI digits and an "updated at" chrome bar are **out of reach** for
overrides; a full radar look would need its own theme (bar: two or more real
users asking for it explicitly).

## Comparing themes on a frozen fixture

To see whether a theme is genuinely distinguishable, skin the frozen fixture
instead of generating sample reports — AI-rendered samples drift in wording and
structure, which pollutes the comparison:

```bash
python tests/fixtures/skin_fixture.py minimal forest-editorial dark-board
python tests/fixtures/skin_fixture.py dark-board --overrides primary_color=#5ee1b4 --label radar-board
```

Outputs land in `/tmp/theme-skin/`; open them side by side.

## Sharing Themes

Publish your theme folder as a git repo — others clone it into their `themes/` directory:

```bash
git clone https://github.com/yourname/report-theme-mybrand \
  ~/.claude/skills/report-creator/themes/mybrand
```
