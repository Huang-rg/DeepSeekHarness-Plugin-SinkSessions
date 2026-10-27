# dsh-sink-sessions

**Sink a conversation to the bottom of its workspace** in the DeepSeek Harness
sidebar — the opposite of pinning. A sunk conversation folds out of its group's
normal reading and comes back only when you ask for it.

English | [中文](README.md)

```
📁 SOME
   大肥鱼                        23 小时   📌
   DeepSeek 用量网页全局…          47 分钟   📌
   重大人生抉择倾诉                2 天     📌
   本地部署 DeepSeek 模型配置…      4 天     ↓     ← sunk, mark visible
   形势与政策刷课脚本               7 天     ↓
   展开其余 2 个沉底对话                          ← this plugin
   展开其余 3 个会话                              ← native watermark row
```

| Folded | Expanded | Each workspace keeps its own state |
| :---: | :---: | :---: |
| ![](docs/sink-collapsed.png) | ![](docs/sink-expanded.png) | ![](docs/sink-per-workspace.png) |

## What it adds

| Surface | Behavior |
| --- | --- |
| Session **"..." menu** | `沉底会话` / `取消沉底`, placed at `order` 150 — directly below the shipped Pin row and above Rename. |
| **Row mark** | A 14px down-arrow into a tray, after the relative time. Same seat, size and color as the native pin mark, with `aria-label` / tooltip `已沉底`, so a sunk row is recognizable without opening the menu. |
| **Group reveal row** | `展开其余 N 个沉底对话` directly above the native group control; expands the group's sunk rows in place. It turns into `收起沉底会话` while expanded, so it never reads like the native `收起`. |
| **Persistence** | Sunk session ids are kept in `localStorage` (`dsh-sink-sessions.v1`), per browser. Reveal state is transient and starts folded, like the native watermark. |

Pin and sink are opposites: pin lifts a row to the front of the group, sink folds
it to the bottom of the group's reading.

## Requirements

- DeepSeek Harness with the Web client: `@deepseek-ai/dsh-client-ui-workspace`
  and `@deepseek-ai/dsh-client-ui-sidebar` must be present (they are in the
  standard desktop profile).
- Developed and verified against **0.2.1-rc.3** (desktop, Windows). The plugin
  reads the sidebar's rendered list, so a future release that changes that DOM
  contract can make the hiding stop working — see [Limitations](#limitations).

## Install

From a local checkout:

```bash
git clone https://github.com/<your-account>/<repo>.git
dsh plugin install ./<repo>
```

Or point the Plugin Manager at this directory (Plugins page → install bundle →
local directory). Then **reload the page** (`Ctrl+R`): the Client half is loaded
per page load.

Verify: open any session's `...` menu — `沉底会话` should sit right under
`置顶会话`.

### Uninstall

```bash
dsh plugin remove dsh-sink-sessions
```

or delete the `dsh-sink-sessions` row from the profile's `dsh.profile.bundles`
and `dependencies`. Sunk ids left in `localStorage` are limited to
`dsh-sink-sessions.v1` and can be cleared with it.

## Limitations

This is a **UI-layer extension, not a native list feature**. The native browser
owns row derivation and the per-workspace watermark; it offers seats for a menu
row, a hover button, a leading decoration and a hover-card section, but no hook
that filters or reorders rendered rows. Consequences:

- **The native count still includes sunk rows.** The native `展开其余 N 个会话`
  counts the watermark's hidden rows, sunk ones included, so its number can be
  larger than what it reveals. This plugin's own row only counts sunk rows.
- **Revealed rows are not reordered.** Expanding puts the sunk rows back in their
  chronological position; they are not moved below the ordinary rows.
- **It depends on two structure facts:** rows are `[data-row-key="session:<id>"]`,
  and a group's own session rows are direct children of the element holding its
  `[data-row-key="workspace:<key>"]`. If a release changes either, the plugin
  stops hiding rows (it does not crash).
- **The flat ("one list") view** has no group to fold into, so it gets a single
  reveal row at the end of the list.
- **Web client only.** The Client half is declared with `dsh.client.platform: web`.

## How it works

- The menu row is an ordinary `sidebar.workspaces.session.menu.item`
  registration, ordered between Pin (100) and Rename (200).
- A `MutationObserver` keeps the rendered list in sync: sunk rows get inline
  `display: none` (React never sets `display` on those rows) plus
  `data-sink-hidden`, and a mark element and a reveal `button` are placed into
  the group. Both are idempotent, so React re-renders cannot accumulate copies.
- No network calls, no telemetry, no host-side state. The only stored data is the
  set of sunk session ids in `localStorage`.

## Development

Single-file Client half, no build step:

```
package.json          bundle manifest (dsh.bundle.patch + dsh.client)
cordis.patch.yml      inserts the Host row
index.js              Host half: export function apply() {}
client.js             whole UI: state, DOM sync, menu row, reveal row, mark
locale/en.json        Plugin Manager display metadata
locale/zh.json
icon.svg
```

Layout of the bundle follows the Harness plugin contract: the host row mounts the
package, `dsh.client` serves `client.js` to the browser, and the Client half
registers into slots through `ctx.slots.inject`.

## License

MIT — see [LICENSE](LICENSE).
