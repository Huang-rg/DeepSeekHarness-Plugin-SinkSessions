/**
 * Sink sessions (沉底会话) — a fourth row state beside pin.
 *
 * A sunk Session leaves the normal reading of its workspace group: its row is
 * hidden while the group is collapsed, and a group-local "展开其余 N 个沉底对话"
 * row reveals the sunk rows in place. Pin and sink are opposite ends of the
 * same idea, so this row sits right after the shipped Pin row (order 150).
 *
 * The native browser owns row derivation and its watermark; it exposes a menu
 * seat but no row filter, so the hiding itself is done on the rendered list:
 * rows are `[data-row-key="session:<id>"]` inside the group section that the
 * per-group toggle is appended to. React does not own the appended button, so
 * a MutationObserver keeps it in place, and only inline `display` (which React
 * never sets on these rows) is touched.
 */

window.__ModuleLoader__.load({
  id: 'dsh-sink-sessions',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const useSyncExternalStore = React.useSyncExternalStore;

    /** Locale namespace of this plugin. */
    const NS = 'sink-sessions';
    /** Where the sunk Session ids live (per browser profile). */
    const STORAGE_KEY = 'dsh-sink-sessions.v1';
    /** Marks our stylesheet so a reload does not stack copies. */
    const CSS_TAG_ID = 'dsh-sink-sessions/client.css';

    const ROW_SELECTOR = '[data-row-key]';
    const SESSION_PREFIX = 'session:';
    const WORKSPACE_PREFIX = 'workspace:';

    /** Flat menu-row dictionaries; the Client locale service owns selection. */
    const en = {
      'menu.sink': 'Sink to the bottom',
      'menu.unsink': 'Restore from the bottom',
      'toggle.expand': 'Show {n} sunk conversation(s)',
      'toggle.collapse': 'Hide sunk conversations',
      'mark.sunk': 'Sunk conversation',
    };
    const zh = {
      'menu.sink': '沉底会话',
      'menu.unsink': '取消沉底',
      'toggle.expand': '展开其余 {n} 个沉底对话',
      'toggle.collapse': '收起沉底会话',
      'mark.sunk': '已沉底',
    };

    // ------------------------------------------------------------------ state

    /**
     * Read the persisted sunk set. Reveal state is deliberately transient: a
     * reload starts with sunk rows folded, like the native watermark.
     * @returns {{ sunk: Set<string>, revealed: Set<string>, revealAll: boolean }}
     */
    function initialState() {
      let sunk = [];
      try {
        const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
        const parsed = raw === null || raw === undefined ? null : JSON.parse(raw);
        if (parsed && Array.isArray(parsed.sunk)) {
          sunk = parsed.sunk.filter((id) => typeof id === 'string' && id.length > 0);
        }
      } catch {
        /* a corrupted or unavailable store starts empty */
      }
      return { sunk: new Set(sunk), revealed: new Set(), revealAll: false };
    }

    let state = initialState();
    const listeners = new Set();
    /** Current translate function; `apply` replaces it with the locale seat. */
    let translate = (key, params) => (params === undefined ? key : `${key} ${JSON.stringify(params)}`);

    function subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    }

    function getSnapshot() {
      return state;
    }

    function emit() {
      for (const listener of [...listeners]) listener();
    }

    function persist() {
      try {
        globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify({ sunk: [...state.sunk] }));
      } catch {
        /* storage is best effort; the in-memory set still works */
      }
    }

    function isSunk(sessionId) {
      return state.sunk.has(sessionId);
    }

    /** Flip one Session between ordinary and sunk. */
    function toggleSunk(sessionId) {
      const sunk = new Set(state.sunk);
      if (sunk.has(sessionId)) sunk.delete(sessionId);
      else sunk.add(sessionId);
      state = { ...state, sunk };
      persist();
      emit();
      scheduleSync();
    }

    /**
     * Reveal or fold the sunk rows of one group.
     * @param {string | null} groupKey - workspace group key, or null for the flat list.
     */
    function toggleReveal(groupKey) {
      if (groupKey === null) {
        state = { ...state, revealAll: !state.revealAll };
      } else {
        const revealed = new Set(state.revealed);
        if (revealed.has(groupKey)) revealed.delete(groupKey);
        else revealed.add(groupKey);
        state = { ...state, revealed };
      }
      emit();
      scheduleSync();
    }

    // -------------------------------------------------------------------- DOM

    let frame = 0;

    /** Coalesce every DOM change in a frame into one sync. */
    function scheduleSync() {
      if (typeof document === 'undefined' || frame !== 0) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        sync();
      });
    }

    /**
     * Hide or restore one rendered Session row.
     * @param {Element} row - the row element addressed by `data-row-key`.
     * @param {boolean} hidden - whether the row must leave the group's reading.
     */
    function setHidden(row, hidden) {
      if (hidden) {
        if (row.style.display !== 'none') row.style.display = 'none';
        if (!row.hasAttribute('data-sink-hidden')) row.setAttribute('data-sink-hidden', '');
        return;
      }
      if (!row.hasAttribute('data-sink-hidden')) return;
      row.style.display = '';
      row.removeAttribute('data-sink-hidden');
    }

    const SVG_NS = 'http://www.w3.org/2000/svg';

    /**
     * The sunk mark glyph: a down arrow into a tray, the mirror of the pin.
     * @param {number} size - glyph size in CSS pixels.
     * @returns {SVGElement} the glyph element.
     */
    function sinkGlyphElement(size) {
      const svg = document.createElementNS(SVG_NS, 'svg');
      svg.setAttribute('viewBox', '0 0 16 16');
      svg.setAttribute('width', String(size));
      svg.setAttribute('height', String(size));
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('focusable', 'false');
      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', 'M8 3v6.2M8 9.2 5.4 6.6M8 9.2l2.6-2.6M3.6 12.6h8.8');
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', 'currentColor');
      path.setAttribute('stroke-width', '1.3');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');
      svg.appendChild(path);
      return svg;
    }

    /**
     * Show or clear the trailing "sunk" mark on one rendered Session row. It
     * takes the seat the native pin indicator takes — right after the relative
     * time, before the row's action strip — so a sunk row reads at a glance
     * instead of only from the menu.
     * @param {Element} row - the session row element.
     * @param {boolean} sunk - whether the row's Session is sunk.
     */
    function updateMark(row, sunk) {
      const existing = row.querySelector(':scope > [data-sink-mark]');
      if (!sunk) {
        if (existing !== null) existing.remove();
        return;
      }
      let mark = existing;
      if (mark === null) {
        mark = document.createElement('span');
        mark.className = 'dsh-sink-mark';
        mark.setAttribute('data-sink-mark', '');
        mark.setAttribute('role', 'img');
        mark.appendChild(sinkGlyphElement(14));
        row.appendChild(mark);
      }
      const label = translate('mark.sunk');
      if (mark.getAttribute('aria-label') !== label) {
        mark.setAttribute('aria-label', label);
        mark.title = label;
      }
      const anchor = row.lastElementChild;
      if (anchor !== null && anchor !== mark && mark.nextElementSibling !== anchor) {
        row.insertBefore(mark, anchor);
      }
    }

    /**
     * Keep the group's reveal row in sync with what the group currently
     * renders: native overflow counts stay the owner's business, this row only
     * ever counts the sunk rows currently on screen.
     * @param {{
     *   container: Element,
     *   groupKey: string | null,
     *   all: Element[],
     *   sunk: Element[],
     * }} bucket - one rendered group (or the flat list when groupKey is null).
     * @param {boolean} revealed - whether this bucket currently shows its sunk rows.
     */
    function updateToggle(bucket, revealed) {
      const existing = bucket.container.querySelector(':scope > [data-sink-toggle]');
      if (bucket.sunk.length === 0) {
        if (existing !== null) existing.remove();
        return;
      }
      let button = existing;
      if (button === null) {
        button = document.createElement('button');
        button.type = 'button';
        button.className = 'dsh-sink-toggle';
        button.setAttribute('data-sink-toggle', '');
        button.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          const key = button.getAttribute('data-sink-group');
          toggleReveal(key === null || key === '' ? null : key);
        });
        bucket.container.appendChild(button);
      }
      // Keep the reveal row directly above the native group control
      // (`overflow:<group>`, the "展开其余 N 个会话" / "收起" row), which stays
      // the group's last row. React appends new rows after ours, so the row is
      // re-placed on every pass.
      const overflow = bucket.container.querySelector(':scope > [data-row-key^="overflow:"]');
      if (overflow !== null) {
        if (button.nextElementSibling !== overflow) bucket.container.insertBefore(button, overflow);
      } else if (bucket.container.lastElementChild !== button) {
        bucket.container.appendChild(button);
      }
      const groupKey = bucket.groupKey === null ? '' : bucket.groupKey;
      if (button.getAttribute('data-sink-group') !== groupKey) button.setAttribute('data-sink-group', groupKey);
      const text = revealed ? translate('toggle.collapse') : translate('toggle.expand', { n: bucket.sunk.length });
      if (button.textContent !== text) button.textContent = text;
      button.setAttribute('aria-expanded', revealed ? 'true' : 'false');
    }

    const WORKSPACE_ROW_SELECTOR = '[data-row-key^="workspace:"]';

    /**
     * Nearest ancestor that is a workspace group section: the element that owns a
     * workspace header row, wherever that row sits inside it. Rows (both session
     * rows and the workspace header) are wrapped by their hover-card anchor, so a
     * row's own parent is never the group — bucketing by parent would create one
     * reveal row per sunk Session.
     * @param {Element} row - a rendered session row.
     * @returns {Element | null} the group section, or null outside grouped browsing.
     */
    function enclosingGroup(row) {
      let node = row.parentElement;
      while (node !== null && node !== document.body) {
        if (node.querySelector(WORKSPACE_ROW_SELECTOR) !== null) return node;
        node = node.parentElement;
      }
      return null;
    }

    /**
     * Read the workspace group key of a group section: the row key of the
     * section's own header row. The header is the first workspace row in tree
     * order, because a group renders its header before its child groups.
     * @param {Element} section - a workspace group section.
     * @returns {string | null} the group key, or null when it cannot be read.
     */
    function readGroupKey(section) {
      const header = section.querySelector(WORKSPACE_ROW_SELECTOR);
      const key = header === null ? undefined : header.dataset.rowKey;
      return typeof key === 'string' && key.startsWith(WORKSPACE_PREFIX)
        ? key.slice(WORKSPACE_PREFIX.length)
        : null;
    }

    /**
     * Lowest common ancestor of the given rows, used when browsing is flat and
     * there is no group section to fold into.
     * @param {Element[]} rows - rendered session rows.
     * @returns {Element | null} the shared ancestor below the document body.
     */
    function commonAncestor(rows) {
      let node = rows[0].parentElement;
      while (node !== null && node !== document.body) {
        if (rows.every((row) => node.contains(row))) return node;
        node = node.parentElement;
      }
      return null;
    }

    /** Re-apply the sunk reading to the rendered list. */
    function sync() {
      if (typeof document === 'undefined') return;
      const rows = Array.from(document.querySelectorAll(ROW_SELECTOR));
      if (rows.length === 0) return;
      /** @type {Map<Element, { container: Element, groupKey: string | null, all: Element[], sunk: Element[] }>} */
      const buckets = new Map();
      const loose = [];
      for (const row of rows) {
        const key = row.dataset.rowKey;
        if (typeof key !== 'string' || !key.startsWith(SESSION_PREFIX)) continue;
        const section = enclosingGroup(row);
        if (section === null) {
          loose.push(row);
          continue;
        }
        let bucket = buckets.get(section);
        if (bucket === undefined) {
          bucket = { container: section, groupKey: readGroupKey(section), all: [], sunk: [] };
          buckets.set(section, bucket);
        }
        bucket.all.push(row);
        if (isSunk(key.slice(SESSION_PREFIX.length))) bucket.sunk.push(row);
      }
      if (loose.length > 0) {
        const container = commonAncestor(loose);
        if (container !== null) {
          buckets.set(container, {
            container,
            groupKey: null,
            all: loose,
            sunk: loose.filter((row) => isSunk(row.dataset.rowKey.slice(SESSION_PREFIX.length))),
          });
        }
      }
      for (const bucket of buckets.values()) {
        // The flat list has no group to fold into, so its single row is global;
        // every group row belongs to its own workspace and must not move others.
        const revealed = bucket.groupKey === null
          ? state.revealAll
          : state.revealed.has(bucket.groupKey);
        for (const row of bucket.all) {
          const key = row.dataset.rowKey;
          const sunk = isSunk(key.slice(SESSION_PREFIX.length));
          setHidden(row, !revealed && sunk);
          updateMark(row, sunk);
        }
        updateToggle(bucket, revealed);
      }
      // A folded group or an unsunk Session leaves a toggle behind: drop it.
      for (const button of Array.from(document.querySelectorAll('[data-sink-toggle]'))) {
        const container = button.parentElement;
        const bucket = container === null ? undefined : buckets.get(container);
        if (bucket === undefined || bucket.sunk.length === 0) button.remove();
      }
    }

    /** Undo every DOM change this plugin made (plugin unload). */
    function teardownDom() {
      if (typeof document === 'undefined') return;
      for (const button of Array.from(document.querySelectorAll('[data-sink-toggle]'))) button.remove();
      for (const mark of Array.from(document.querySelectorAll('[data-sink-mark]'))) mark.remove();
      for (const row of Array.from(document.querySelectorAll('[data-sink-hidden]'))) {
        row.style.display = '';
        row.removeAttribute('data-sink-hidden');
      }
    }

    // ------------------------------------------------------------------- view

    /** Down-into-the-tray glyph: the opposite of the pin mark. */
    function SinkIcon() {
      return h('svg', {
        viewBox: '0 0 16 16',
        width: 16,
        height: 16,
        'aria-hidden': 'true',
        focusable: 'false',
      }, h('path', {
        d: 'M8 2.6v6.6M8 9.2 5.3 6.5M8 9.2l2.7-2.7M3.4 12.9h9.2',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.25,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      }));
    }

    /** The shipped menu-row primitive, when the loader exposes it. */
    let MenuItemButton = null;
    try {
      const primitives = require('@deepseek-ai/dsh-client-ui-primitives');
      if (primitives && typeof primitives.MenuItemButton === 'function') MenuItemButton = primitives.MenuItemButton;
    } catch {
      /* fall back to the local row below */
    }

    /**
     * One row in a Session's "..." menu: Sink / Restore.
     * @param {object} props - row owner props, locale seat, and the menu hook.
     * @returns {object} the menu row element.
     */
    function SinkMenuItem(props) {
      const { sessionId, useMenuOpenState, t } = props;
      const current = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
      const sunk = current.sunk.has(sessionId);
      const label = t(sunk ? 'menu.unsink' : 'menu.sink');
      const menuState = typeof useMenuOpenState === 'function' ? useMenuOpenState() : null;
      const closeMenu = menuState === null || menuState === undefined ? () => {} : menuState[1];
      const select = () => {
        closeMenu(false);
        toggleSunk(sessionId);
      };
      if (MenuItemButton !== null) {
        return h(MenuItemButton, { icon: h(SinkIcon, null), onSelect: select }, label);
      }
      return h('button', {
        type: 'button',
        role: 'menuitem',
        className: 'dsh-sink-menu',
        onClick: select,
      }, h(SinkIcon, null), h('span', null, label));
    }

    // ------------------------------------------------------------------ styles

    const CSS = [
      '.dsh-sink-toggle{box-sizing:border-box;width:100%;height:28px;margin:0;padding:0 12px 0 calc(28px + var(--dsh-workspace-indent,0px));cursor:pointer;text-align:left;color:var(--dsw-alias-label-tertiary);background:0 0;border:none;font-size:12px;line-height:18px}',
      '.dsh-sink-toggle:hover{color:var(--dsw-alias-label-secondary)}',
      '.dsh-sink-toggle:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:-2px}',
      '.dsh-sink-mark{width:16px;height:20px;color:var(--dsw-alias-label-caption);flex:none;justify-content:center;align-items:center;margin-left:6px;display:inline-flex;pointer-events:none}',
      '.dsh-sink-menu{display:flex;align-items:center;gap:8px;width:100%;height:32px;padding:0 8px;cursor:pointer;text-align:left;color:var(--dsw-alias-label-primary);background:0 0;border:none;border-radius:var(--dsw-radius-sm);font-size:13px;line-height:18px}',
      '.dsh-sink-menu:hover{background:var(--dsw-alias-interactive-bg-hover)}',
    ].join('');

    /** Install the stylesheet once, and return its remover. */
    function injectCss() {
      const selector = `style[data-plugin-css=${JSON.stringify(CSS_TAG_ID)}]`;
      if (document.querySelector(selector) !== null) return () => {};
      const tag = document.createElement('style');
      tag.dataset.plugin = 'dsh-sink-sessions';
      tag.dataset.pluginCss = CSS_TAG_ID;
      tag.textContent = CSS;
      document.head.appendChild(tag);
      return () => tag.remove();
    }

    // ------------------------------------------------------------------- plugin

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { en, zh }), 'dsh-sink-sessions: dictionaries');
        translate = ctx.locale.bind(NS);
        ctx.effect(injectCss, 'dsh-sink-sessions: stylesheet');

        ctx.effect(() => {
          const observer = new MutationObserver(() => scheduleSync());
          observer.observe(document.body, { childList: true, subtree: true });
          const unsubscribe = ctx.locale.subscribe(() => scheduleSync());
          scheduleSync();
          return () => {
            observer.disconnect();
            unsubscribe();
            if (frame !== 0) {
              cancelAnimationFrame(frame);
              frame = 0;
            }
            teardownDom();
          };
        }, 'dsh-sink-sessions: list binding');

        // Order 150 keeps this row immediately after the shipped Pin (100).
        ctx.slots.inject('sidebar.workspaces.session.menu.item', () => ctx.slots.register({
          name: 'sidebar.workspaces.session.menu.item',
          id: 'sink-sessions',
          order: 150,
          locale: NS,
        }, SinkMenuItem));
      },
    };
  },
});
