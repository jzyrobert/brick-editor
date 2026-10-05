/**
 * What each section menu holds (the Project, Photo, Instructions and Play
 * cards, and the Inspector's Tools tab), in order. ModeMenu lays a menu out
 * as its pinned actions over a row of task tabs; components pass each
 * section's content by id. A new tool or setting gets an entry here (its
 * name and tab) and its content where the menu is rendered.
 */
export type MenuKey = "Project" | "Photo" | "Instructions" | "Play" | "Tools";

export type MenuEntry = {
  id: string;
  /** The section's heading in its tab (and its drawer, in Tools). */
  label: string;
  /** Always shown above the tabs: the menu's main actions and alerts. */
  pin?: boolean;
  /** The tab it sits in (Tools: the group heading). */
  tab?: string;
  /** Its content is already a drawer (a root `<details>`): shown open. */
  own?: boolean;
  /** Only useful with a keyboard and mouse: hidden on touch screens. */
  fine?: boolean;
};

export const MENUS: Record<MenuKey, MenuEntry[]> = {
  Project: [
    { id: "library-update", label: "Parts library update", pin: true },
    { id: "files", label: "Open or back up", pin: true },
    { id: "templates", label: "Start from a template", tab: "New" },
    { id: "official", label: "Official LEGO sets", tab: "New" },
    { id: "saved", label: "Saved on this device", tab: "My builds" },
    { id: "checkpoints", label: "Checkpoints", tab: "My builds" },
    { id: "health", label: "Model health", tab: "My builds" },
    { id: "clear", label: "Clear saved builds", tab: "My builds" },
    { id: "export", label: "Export LDraw", tab: "Export" },
    { id: "share", label: "Share a link", tab: "Export" },
    { id: "offline", label: "Use offline", tab: "Settings" },
    { id: "limits", label: "Device limits", tab: "Settings" },
    {
      id: "shortcuts",
      label: "Keyboard shortcuts",
      tab: "Settings",
      own: true,
      fine: true,
    },
    { id: "about", label: "About and licences", tab: "Settings" },
  ],
  Photo: [
    { id: "download", label: "Download picture", pin: true },
    { id: "look", label: "Look", tab: "Picture" },
    { id: "size", label: "Picture size", tab: "Picture" },
    { id: "views", label: "Saved views", tab: "Saved views" },
    { id: "exact", label: "Exact camera position", tab: "Saved views" },
    { id: "collection", label: "Camera collection", tab: "Saved views" },
    { id: "quality", label: "Render quality", tab: "Quality" },
  ],
  Instructions: [
    { id: "follow", label: "Build it step by step", pin: true },
    { id: "step", label: "Preview a plan", tab: "Step plans" },
    { id: "plan", label: "Make and edit plans", tab: "Step plans" },
    { id: "publish", label: "Publish", tab: "Publish" },
  ],
  Play: [
    { id: "hint", label: "Start hint", pin: true },
    { id: "enter", label: "Enter Play", pin: true },
    { id: "mechanisms", label: "Mechanisms", tab: "Mechanisms" },
    {
      id: "world",
      label: "World included in Play",
      tab: "Layers & ground",
      own: true,
    },
    {
      id: "keys",
      label: "Keyboard and mouse",
      tab: "Keyboard",
      own: true,
      fine: true,
    },
  ],
  Tools: [
    { id: "selection", label: "Selection tools", tab: "Select", own: true },
    { id: "replace", label: "Replace part", tab: "Select", own: true },
    { id: "workplane", label: "Workplane and grid", tab: "Model" },
    {
      id: "submodels",
      label: "Submodels and shared editing",
      tab: "Model",
      own: true,
    },
    { id: "rig", label: "Create or edit a rig", tab: "Mechanisms", own: true },
    { id: "seat", label: "Driver seat", tab: "Mechanisms", own: true },
    { id: "physics", label: "Physics settings", tab: "Mechanisms", own: true },
  ],
};
