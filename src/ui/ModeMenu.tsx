import {
  Fragment,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { MENUS, type MenuEntry, type MenuKey } from "./menus";

type Props = {
  menu: MenuKey;
  /** Content per registry id; a falsy value leaves the section out. */
  sections: Partial<Record<string, ReactNode>>;
  /** One-line state shown beside a drawer's name (Tools). */
  hints?: Partial<Record<string, string>>;
  /** Accessible name of the menu region. */
  label: string;
  className?: string;
  hidden?: boolean;
};

/**
 * A section menu (src/ui/menus.ts): its pinned actions, then a row of task
 * tabs, each showing all of its sections open. The Inspector's Tools already
 * sit in a tab of their own, so they are one list of drawers instead.
 */
export function ModeMenu(props: Props) {
  const entries = MENUS[props.menu].filter((e) => !!props.sections[e.id]);
  return (
    <div
      className={
        (props.className ?? "mode-card") +
        " menu menu-" +
        props.menu.toLowerCase()
      }
      role="region"
      aria-label={props.label}
      hidden={props.hidden}
    >
      {props.menu === "Tools" ? (
        <DrawerList entries={entries} props={props} />
      ) : (
        <Tabs entries={entries} props={props} />
      )}
    </div>
  );
}

const fine = (e: MenuEntry) => (e.fine ? " menu-fine" : "");

/** Drawers that make up a list: only one of them is open at a time. */
const DRAWERS =
  ".menu-drawers > details, .menu-drawers > .menu-own > details, .menu-drawers > .menu-own > section > details:first-child";

/** Opening one drawer in the list closes the others and scrolls into view. */
function useOneOpen(ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const toggle = (e: Event) => {
      const t = e.target;
      if (!(t instanceof HTMLDetailsElement) || !t.open || !t.matches(DRAWERS))
        return;
      el.querySelectorAll<HTMLDetailsElement>(DRAWERS).forEach((d) => {
        if (d !== t && d.open) d.open = false;
      });
      // A drawer opened near the bottom of the sheet scrolls up into view.
      requestAnimationFrame(() => {
        const sheet = t.closest(".mode-card, .mobile-panel, .right-sidebar");
        if (
          sheet &&
          t.getBoundingClientRect().bottom >
            sheet.getBoundingClientRect().bottom
        )
          t.scrollIntoView({
            block: "start",
            behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
              ? "auto"
              : "smooth",
          });
      });
    };
    el.addEventListener("toggle", toggle, true);
    return () => el.removeEventListener("toggle", toggle, true);
  }, [ref]);
}

/** A section that brings its own drawer shows it open, its summary hidden
 * (the tab's heading names it). Runs after every render so a section that
 * appears later opens too. */
function useUnwrap(ref: React.RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    ref.current
      ?.querySelectorAll<HTMLDetailsElement>(
        ".menu-unwrap > details:not([open]), .menu-unwrap > section > details:first-child:not([open])",
      )
      .forEach((d) => (d.open = true));
  });
}

/** The Inspector's tools: drawers under group headings, one open at a time. */
function DrawerList({
  entries,
  props,
}: {
  entries: MenuEntry[];
  props: Props;
}) {
  const list = useRef<HTMLDivElement>(null);
  useOneOpen(list);
  let group: string | undefined;
  return (
    <div className="menu-drawers" ref={list}>
      {entries.map((entry) => {
        const heading = entry.tab !== group;
        group = entry.tab;
        const content = props.sections[entry.id];
        const hint = props.hints?.[entry.id];
        return (
          <Fragment key={entry.id}>
            {heading && <h3 className="menu-group">{entry.tab}</h3>}
            {entry.own ? (
              <div className={"menu-own" + fine(entry)}>{content}</div>
            ) : (
              <details className={"drawer menu-drawer" + fine(entry)}>
                <summary>
                  <span>{entry.label}</span>
                  {hint && <small className="menu-hint">{hint}</small>}
                </summary>
                <div className="menu-body">{content}</div>
              </details>
            )}
          </Fragment>
        );
      })}
    </div>
  );
}

/** The tab each menu was last left on, so coming back finds it there. */
const lastTab = new Map<MenuKey, string>();

/** Pinned actions, then task tabs. Every tab stays mounted (hidden), so a
 * half-typed field survives a switch. */
function Tabs({ entries, props }: { entries: MenuEntry[]; props: Props }) {
  const id = useId();
  const pins = entries.filter((e) => e.pin);
  const rest = entries.filter((e) => !e.pin);
  const tabs = [...new Set(rest.map((e) => e.tab ?? "More"))];
  const [tab, setTab] = useState(() => lastTab.get(props.menu) ?? tabs[0]);
  const current = tabs.includes(tab) ? tab : tabs[0];
  const root = useRef<HTMLDivElement>(null);
  useUnwrap(root);
  const tabbed = tabs.length > 1;
  return (
    <>
      {pins.map((e) => (
        <div key={e.id} className={"menu-block menu-" + e.id}>
          {props.sections[e.id]}
        </div>
      ))}
      {tabbed && (
        <div className="menu-tabs" role="tablist" aria-label={props.label}>
          {tabs.map((t, i) => (
            <button
              key={t}
              role="tab"
              id={id + "tab" + i}
              aria-selected={t === current}
              aria-controls={id + "panel" + i}
              className={
                rest.filter((e) => (e.tab ?? "More") === t).every((e) => e.fine)
                  ? "menu-fine"
                  : undefined
              }
              onClick={() => {
                lastTab.set(props.menu, t);
                setTab(t);
              }}
            >
              {t}
            </button>
          ))}
        </div>
      )}
      <div ref={root} className="menu-panels">
        {tabs.map((t, i) => {
          const shown = rest.filter((e) => (e.tab ?? "More") === t);
          const single = shown.length === 1;
          return (
            <div
              key={t}
              className="menu-panel"
              role={tabbed ? "tabpanel" : undefined}
              id={id + "panel" + i}
              aria-labelledby={tabbed ? id + "tab" + i : undefined}
              hidden={t !== current}
            >
              {shown.map((entry) => (
                <section
                  key={entry.id}
                  className={
                    "menu-section menu-" +
                    entry.id +
                    (entry.own ? " menu-unwrap" : "") +
                    fine(entry)
                  }
                >
                  {!single && (
                    <h3 className="menu-section-title">{entry.label}</h3>
                  )}
                  {props.sections[entry.id]}
                </section>
              ))}
            </div>
          );
        })}
      </div>
    </>
  );
}
