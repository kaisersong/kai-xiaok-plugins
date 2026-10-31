# Reject unsupported Mermaid before artifact output

Observed: validate_ir returned valid and render_report reported passing validation while a raw Mermaid fence became a single prose line. The real PO rejected the artifact; that rejection remains valid. The artifact was separately corrected using supported native diagrams, without changing its accepted Markdown source.

The shared detector scans the real frontmatter body and reports original 1-based lines. It matches Mermaid info tokens, case/CRLF/indentation and paired fence character/length. It respects the actual parser's native code block spans and outer Markdown literal-example fences. Ordinary Markdown fence rendering is unchanged and is not claimed to be fixed. Pseudo directives inside callouts do not suppress detection.

validate_ir fails with fixed guidance and no graph content. The common renderReport entry rejects before normal/animated branching or file writes, returns empty HTML and failed validation, and preserves an existing output file. No Mermaid runtime, network call or permission expansion is introduced. This guard only covers unsupported Mermaid fences, not every unsupported Markdown feature.

Independent gpt-6-astra DESIGN APPROVE preceded implementation. Actual tools regression: RED 12 failed / 1 passed; GREEN full renderer suite 267/267 (11 files), including 13 new cases. npm run build and build:bundle passed. Tracked dist and the production MCP bundle are rebuilt. CI runs the full suite/build on Linux, Windows and macOS, Node 22.22/24. Final CODE review and installed MCP evidence are recorded separately; no signing or release is implied.
