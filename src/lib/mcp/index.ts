import { auth, defineMcp } from "@lovable.dev/mcp-js";

import listChildrenTool from "./tools/list-children";
import listReportsTool from "./tools/list-reports";
import getReportTool from "./tools/get-report";
import whoamiTool from "./tools/whoami";

// Read the direct Supabase project ref at build time. `import.meta.env.VITE_*`
// is inlined by Vite; `process.env.SUPABASE_URL` on publish is the proxy form
// and is rejected as an OAuth issuer.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "neurolearn-mcp",
  title: "NeuroLearn AI",
  version: "0.1.0",
  instructions:
    "Read-only access to the signed-in user's NeuroLearn AI data. Use `whoami` to identify the user, `list_children` to see their child profiles, `list_reports` to browse assessment/game reports (optionally filtered by child), and `get_report` to fetch full details of one report.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [whoamiTool, listChildrenTool, listReportsTool, getReportTool],
});
