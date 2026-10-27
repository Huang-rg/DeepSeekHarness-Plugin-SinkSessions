# Changelog

All notable changes to this plugin. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.2] — 2026-10-27

### Fixed

- Reveal state is keyed by workspace again: toggling one workspace no longer
  folds or expands another. The group key was still read from a *direct*
  workspace-row child of the group element, which the hover-card wrapper hides,
  so every group fell back to a `null` key and shared the flat list's global
  reveal flag.
- `revealAll` now applies only to the flat list; a real group always reads its
  own key from its section.

## [0.2.1] — 2026-10-27

### Fixed

- One reveal row per workspace group instead of one per sunk Session. The
  browser wraps each Session row (its hover-card anchor), so a row's own parent
  is not the group; the plugin now walks up to the element that owns the
  workspace header row. A group with five sunk conversations shows a single
  `展开其余 5 个沉底对话` row.
- Reveal state is now per group: expanding one workspace no longer reveals sunk
  rows in every other workspace.
- The reveal row is placed before the native group control in the group element
  even when rows are wrapped.

## [0.2.0] — 2026-10-27

### Added

- Row mark: a 14px down-arrow after the relative time, in the same seat and color
  as the native pin mark, so sunk rows are recognizable while expanded.
- `mark.sunk` locale entries (`已沉底` / `Sunk conversation`) for the mark's label
  and tooltip.

### Changed

- The collapse label is now `收起沉底会话` / `Hide sunk conversations`, so it no
  longer duplicates the native group `收起`.
- The reveal row is now pinned directly above the native group control
  (`[data-row-key^="overflow:"]`) instead of trailing whatever React appended last,
  and its placement check is idempotent.

## [0.1.0] — 2026-10-27

### Added

- Session "..." menu row `沉底会话` / `取消沉底` at `order` 150, between the shipped
  Pin and Rename rows.
- Per-group reveal row `展开其余 N 个沉底对话` with a matching collapse state.
- Browser persistence of sunk session ids in `localStorage`
  (`dsh-sink-sessions.v1`).
- Flat-list fallback: one reveal row at the end of the list.
- Bundle scaffold: Host row, Client half, locale metadata, icon.
