import { main } from "./brick-cli";
await main([
  "render",
  "--input",
  "fixtures/ldraw/studio.mpd",
  "--camera",
  "fixtures/renders/interior.camera.json",
  "--width",
  "1600",
  "--height",
  "1200",
  "--output",
  "interior.png",
  "--report",
  "interior.render.json",
]);
