const path = require("path");

module.exports = {
  appId: "com.yourdomain.poolhallmanager",
  directories: {
    output: "build",
  },
  files: ["dist/**/*", "package.json"],
  extraMetadata: {
    main: "dist/main/main.js",
  },
  // Handle the path alias during production build
  extraResources: [
    {
      from: "src",
      to: "src",
      filter: ["**/*"],
    },
  ],
  // Add platform-specific configurations
  mac: {
    target: ["dmg", "zip"],
    category: "public.app-category.business",
  },
  win: {
    target: ["nsis", "portable"],
  },
  linux: {
    target: ["AppImage", "deb"],
    category: "Office",
  },
};
