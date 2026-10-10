# Output Metadata Contract

Load when: `--generate` render (after shell assembly, before final quality gate).

## Purpose

Every rendered HTML report embeds a `<script type="application/ld+json">` block in `<head>` that self-describes provenance using schema.org vocabulary. This enables downstream consumers (search, AI agents, artifact catalogs) to extract structured metadata without parsing the full DOM.

## Position Rule

The JSON-LD script must appear:
- **After** `<title>`
- **Before** the first `<style>` or `<link rel="stylesheet">`

## Field Contract (metadataVersion = "1")

| JSON-LD Field | Source | Required | Notes |
|---|---|---|---|
| `@context` | Constant | Yes | Always `"http://schema.org/"` (http, not https) |
| `@type` | Constant | Yes | Always `"Report"` |
| `@id` | Derived from ir-hash | Conditional | `"https://kai.app/id/report/<hex16>"` — only when `<meta name="ir-hash">` is present |
| `name` | `frontmatter.title` | Yes | Non-empty string |
| `inLanguage` | `frontmatter.lang` | Yes | `"zh-CN"` or `"en-US"` |
| `dateCreated` | Generation timestamp | Yes | ISO 8601 date (`YYYY-MM-DD`) |
| `creator.@type` | Constant | Yes | `"Organization"` for renderer; `"Person"` if author explicitly provided |
| `creator.name` | Renderer or author | Yes | Default: `"kai-report-creator"` |
| `additionalType` | `frontmatter.archetype` | Optional | `"https://kai.app/ns#report-archetype-<value>"` |
| `additionalProperty[].metadataVersion` | Constant | Yes | PropertyValue with value `"1"` |
| `additionalProperty[].irHash` | `<meta ir-hash>` | Conditional | Bare hex16 (no `sha256:` prefix) — only when meta present |
| `additionalProperty[].reportTheme` | `frontmatter.theme` / `data-theme` | Yes | Theme slug string |
| `additionalProperty[].rendererVersion` | `data-version` | Yes | Semver string |
| `additionalProperty[].reportTemplate` | `frontmatter.template` | Optional | Only when custom template used |

## Hash Dual-Form

The IR hash appears in two forms:

1. **`<meta name="ir-hash" content="sha256:<hex16>">`** — prefixed form, used by shell contract
2. **JSON-LD `irHash` PropertyValue `value: "<hex16>"`** — bare hex, used by metadata consumers

The `@id` URI is always constructed from the bare hex: `https://kai.app/id/report/<hex16>`.

Hash computation: `sha256(normalize_text(ir_text)).hexdigest()[:16]` where `normalize_text(text) = text.strip() + "\n" if text.strip() else ""`.

## Escaping Rules

The JSON-LD payload must be HTML-safe:
- Replace `</` with `<\/` (prevents `</script>` injection)
- Escape U+2028 → `\u2028`, U+2029 → `\u2029`
- Non-ASCII characters may use `\uXXXX` or remain as UTF-8

## PropertyID Allow-List

Only these IRIs are permitted in `additionalProperty[].propertyID`:
- `https://kai.app/ns#metadataVersion`
- `https://kai.app/ns#irHash`
- `https://kai.app/ns#reportTheme`
- `https://kai.app/ns#rendererVersion`
- `https://kai.app/ns#reportTemplate`

## Test Vectors

### Minimal valid (no ir-hash meta)

```json
{
  "@context": "http://schema.org/",
  "@type": "Report",
  "name": "Test Report",
  "inLanguage": "en-US",
  "dateCreated": "2026-06-18",
  "creator": {"@type": "Organization", "name": "kai-report-creator"},
  "additionalProperty": [
    {"@type": "PropertyValue", "propertyID": "https://kai.app/ns#metadataVersion", "value": "1"},
    {"@type": "PropertyValue", "propertyID": "https://kai.app/ns#reportTheme", "value": "corporate-blue"},
    {"@type": "PropertyValue", "propertyID": "https://kai.app/ns#rendererVersion", "value": "1.23.3"}
  ]
}
```

### Full (with ir-hash and archetype)

```json
{
  "@context": "http://schema.org/",
  "@type": "Report",
  "@id": "https://kai.app/id/report/a1b2c3d4e5f60718",
  "name": "Q2增长报告",
  "inLanguage": "zh-CN",
  "dateCreated": "2026-06-18",
  "creator": {"@type": "Organization", "name": "kai-report-creator"},
  "additionalType": "https://kai.app/ns#report-archetype-data",
  "additionalProperty": [
    {"@type": "PropertyValue", "propertyID": "https://kai.app/ns#metadataVersion", "value": "1"},
    {"@type": "PropertyValue", "propertyID": "https://kai.app/ns#irHash", "value": "a1b2c3d4e5f60718"},
    {"@type": "PropertyValue", "propertyID": "https://kai.app/ns#reportTheme", "value": "corporate-blue"},
    {"@type": "PropertyValue", "propertyID": "https://kai.app/ns#rendererVersion", "value": "1.23.3"}
  ]
}
```

## Bump Checklist

When bumping `metadataVersion`:
1. Update `_ALLOWED_PROPERTY_IDS` in `scripts/html_quality_gate.py`
2. Update `check_jsonld` version assertion
3. Update this document's field contract table
4. Update `kai-xiaok-plugins` renderer `jsonld.ts` version constant
5. Add migration test case in `tests/test_jsonld_quality_gate.py`
6. Update `SKILL.md` Output Metadata Contract section
