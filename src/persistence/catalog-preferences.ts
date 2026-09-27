/** Per-device catalogue conveniences. Losing them never affects projects. */
const FAVOURITES = "brick-editor-favourite-parts";
const RECENT = "brick-editor-recent-parts";
const MAX_RECENT = 6;

function read(key: string, known: (id: string) => boolean): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(value)
      ? value.filter((id): id is string => typeof id === "string" && known(id))
      : [];
  } catch {
    return [];
  }
}
function write(key: string, ids: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(ids));
    return true;
  } catch {
    return false;
  }
}
export function loadFavourites(known: (id: string) => boolean) {
  return read(FAVOURITES, known);
}
export function saveFavourites(ids: string[]) {
  return write(FAVOURITES, ids);
}
export function loadRecent(known: (id: string) => boolean) {
  return read(RECENT, known).slice(0, MAX_RECENT);
}
/** Most recent first, without duplicates. */
export function pushRecent(recent: string[], id: string) {
  const next = [id, ...recent.filter((r) => r !== id)].slice(0, MAX_RECENT);
  write(RECENT, next);
  return next;
}
