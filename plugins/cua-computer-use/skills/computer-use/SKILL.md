---
name: cua-computer-use
description: Use when the user asks Xiaok to observe or operate local macOS apps through CUA Driver computer-use tools.
---

# CUA Computer Use

Use this skill only after the Computer Use for Mac plugin is installed, CUA Driver is available, and macOS Accessibility and Screen Recording permissions are granted.

## Tool

Use the product wrapper tool `xiaok_computer_use`; do not shell out to `cua-driver` unless the wrapper is unavailable and the user asked for diagnostics.

Observation actions:

- `{"action":"list_windows","on_screen_only":true}` lists visible windows and their `pid`, `window_id`, `app_name`, `title`, and bounds.
- `{"action":"capture","app":"xiaok"}` or `{"action":"capture","pid":123,"window_id":456}` reads the window AX tree via `get_window_state`.
- `{"action":"screenshot","pid":123,"window_id":456}` captures a visual screenshot when pixel-level inspection is required.

State-changing actions:

- Use `click`, `double_click`, `type`, `key`, `drag`, `scroll`, and related actions only after user confirmation.

## Boundaries

- Ask for user confirmation before actions that click, type, press keys, drag, scroll, launch apps, or otherwise change local app state.
- Prefer observation tools before action tools. Inspect the target app state first, then act on the smallest visible target.
- Do not operate password managers, keychains, payment pages, banking pages, or system security settings unless the user explicitly asks and confirms the target.
- Do not type secrets unless the user provides the exact secret for this action.
- If the tool reports missing macOS permissions, tell the user to grant CUA Driver permissions in System Settings and retry detection.

## Expected Flow

1. Confirm the target app and task.
2. Observe current app/window state with `xiaok_computer_use`.
3. Ask for confirmation before the first state-changing action.
4. Execute one small action at a time.
5. Re-observe after each action before continuing.
