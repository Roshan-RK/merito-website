import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "Merito Recruiter Preview",
  version: "0.2.0",
  description: "See a candidate's verified Merito Hub report while viewing their LinkedIn profile.",
  icons: {
    16: "src/assets/icon-16.png",
    48: "src/assets/icon-48.png",
    128: "src/assets/icon-128.png",
  },
  action: {
    default_popup: "src/popup/index.html",
    default_icon: {
      16: "src/assets/icon-16.png",
      48: "src/assets/icon-48.png",
      128: "src/assets/icon-128.png",
    },
  },
  content_scripts: [
    {
      matches: ["https://www.linkedin.com/in/*"],
      js: ["src/content/index.tsx"],
    },
  ],
  background: {
    service_worker: "src/background/index.ts",
  },
  permissions: ["storage"],
  host_permissions: ["https://www.linkedin.com/*", "https://www.merito.ai/*"],
  web_accessible_resources: [
    {
      resources: ["assets/*.png"],
      matches: ["https://www.linkedin.com/*"],
    },
  ],
});
