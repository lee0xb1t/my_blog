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
    ['link', { rel: 'icon', href: '/logo.png' }]
  ],
});
