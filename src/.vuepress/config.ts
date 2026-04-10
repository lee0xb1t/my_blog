import { defineUserConfig } from "vuepress";

import theme from "./theme.js";

export default defineUserConfig({
  base: "/",

  lang: "zh-CN",
  title: "B1tzz's Blog",
  description: "B1tzz's Blog",

  theme,

  // 和 PWA 一起启用
  // shouldPrefetch: false,

  //
  head: [
    ['link', { rel: 'icon', href: '/logo.png' }],
    
    ["link", { rel: "stylesheet", href: "https://cdn.jsdelivr.net/npm/@ayahub/webfont-harmony-sans-sc/index.css" }],
    ["link", { rel: "stylesheet", href: "https://cdn.jsdelivr.net/npm/hack-font@latest/build/web/hack.css" }],
  ],
});
