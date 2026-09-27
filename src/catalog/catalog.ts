import data from "./data.json";
export const libraryLock = data.libraryLock;
export const mappingLock = data.mappingLock;
export type CatalogPart = {
  id: string;
  name: string;
  width: number;
  depth: number;
  height: number;
  category: string;
  geometryHash: string;
  snapVerified: boolean;
  inventoryBoundary: boolean;
  source: string;
};
export const catalog: Record<string, CatalogPart> = data.catalog;
export const colors = [
  { code: "4", name: "Red", hex: "#c91a09" },
  { code: "1", name: "Blue", hex: "#0055bf" },
  { code: "14", name: "Yellow", hex: "#f2cd37" },
  { code: "15", name: "White", hex: "#ffffff" },
  { code: "0", name: "Black", hex: "#1b2a34" },
  { code: "71", name: "Light grey", hex: "#a0a5a9" },
  { code: "2", name: "Green", hex: "#237841" },
  { code: "19", name: "Tan", hex: "#e4cd9e" },
];
