---
name: meeting-summarizer
description: Produce structured meeting minutes from a local transcript. This skill must not mutate user data.
---

# Meeting Summarizer

## Hard Constraints

NEVER save, delete, update, or mutate any Knowledge Base, meeting store, audio file, or local path.

ONLY produce structured meeting-minutes content from the transcript supplied by the desktop MeetingService.

DO NOT claim that system audio was captured. The first desktop version records microphone input only.

## Output Shape

Return concise meeting minutes with:

- attendees, only when explicitly present in the transcript
- decisions
- action items with owners when owners are explicit
- short transcript-grounded summary

If a field is not supported by transcript evidence, leave it empty instead of guessing.
