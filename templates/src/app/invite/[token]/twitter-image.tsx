// Same card for X/Twitter — Next doesn't reuse opengraph-image automatically.
// `runtime` must be declared here, not re-exported: Next reads these fields
// statically and warns ("can't recognize the exported `runtime` field") if the
// value arrives via `export { runtime } from …`.
import Image, { alt, size, contentType } from "./opengraph-image";

export const runtime = "nodejs";
export { alt, size, contentType };
export default Image;
