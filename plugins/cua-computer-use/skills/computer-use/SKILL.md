---
name: cua-computer-use
description: Use when the user asks Xiaok to observe or operate local macOS or Windows apps through CUA Driver computer-use tools.
---

# CUA Computer Use

Use this skill after the user enables Computer Use in Xiaok Settings. The desktop host selects and validates the platform driver. Windows CLI remains unsupported. Windows initially supports native x64; ARM64 is unavailable until separately verified.

## Tool and workflow

Use only `xiaok_computer_use`. Never call raw MCP tools, start_session, shell screenshot commands or driver commands to bypass unavailable capabilities. Xiaok owns connection recovery. A user-authorized task permits its necessary actions; do not repeatedly ask for the same authorization.

For a Windows browser task, first call `{"action":"open_url","url":"https://..."}` to open the authorized page in the default browser when needed. This action does not accept executable paths, arbitrary arguments, custom URI schemes or capture_after. Then enumerate and capture the browser; launch success does not prove the page loaded. Never use shell start/Start-Process as a browser workaround. After a launch timeout or interruption, inspect windows before considering another launch. For other apps without a supported launch action, ask the user to open the target.

1. List visible windows with `{"action":"list_windows","on_screen_only":true}`. Select the exact `pid` and `window_id`; resolve ambiguity with the user instead of guessing.
2. Capture that target with `{"action":"capture","pid":123,"window_id":456}`. On Windows a confirmed image-capable model must receive the PNG and structured UIA tree. Never act on transport success or a placeholder image alone.
3. Perform one small authorized action using a fresh token or window-local screenshot coordinates. Set `capture_after:true` and verify the observed result before continuing.
4. Capture again after each mutation, interruption or connection generation change. Old tokens and snapshots are unusable.

## Windows targeting

Windows `pid` and `window_id` are positive integers. Use `element_token` from the latest capture of that exact target, or `element_index` together with its host `snapshot_id`. Never invent a token, reuse a previous connection's token, combine element and pixel targets, or select a desktop fallback. Pixel x/y are coordinates in the returned PNG, never screen coordinates. Mutations default to background. Only after COMPUTER_USE_BACKGROUND_UNAVAILABLE for that same target and operation (and button/count for clicks), capture it again and explicitly choose delivery_mode="foreground" if the authorized task still needs that action. Windows double/right clicks without observed web content refuse background pen input before dispatch. Web gestures retain their native background route only for an observed web element or pixel region. Windows middle_click and click/button=middle refuse background before input because the pinned driver may execute a primary UIA Invoke instead of a middle mouse event. Observed Windows Edit controls refuse background pen text selection before sending input; capture again before explicitly requesting foreground mouse drag. Slider and other background drags retain their native route. Never switch focus preemptively or use a shell workaround. If Windows denies target permissions or cannot confirm foreground focus, stop and inspect the target state; do not blindly retry an operation whose effect is unknown.

Windows initialization uses the host's pinned private release and direct MCP mode. Do not install/update drivers, alter autostart, kill shared processes or request credentials as a recovery workaround. Ask the user to unlock or reconnect the desktop when the host reports an unavailable Windows session. Windows does not use macOS Accessibility or Screen Recording settings.

## macOS targeting

Use the macOS fields exposed by the wrapper. If macOS permissions are missing, follow the returned System Settings action and retry after the user grants CUA Driver the relevant permission.

## Boundaries and recovery

- Operate only the app and task authorized by the user. Do not operate payment, banking, password or security settings without explicit authorization for that target.
- Do not type secrets unless the user provides the exact secret for this action.
- If `waitForUserAction:true`, stop and present that action. If a reobserve error has `waitForUserAction:false`, capture the current target again before deciding whether a mutation still needs to be retried.
- A connected empty desktop is not a failed driver. Open or select a target and capture it; do not report screenshot or input verification before it happens.
