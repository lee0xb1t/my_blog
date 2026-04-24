import { sidebar } from "vuepress-theme-hope";

export default sidebar({
  "/": [
    "",
    {
      collapsible: true,
      expanded: true,
      text: "WDM",
      icon: "book",
      prefix: "wdm/",
      children: "structure",
    },
    {
      collapsible: true,
      expanded: true,
      text: "WFP",
      icon: "book",
      prefix: "wfp/",
      children: "structure",
    },
    // "intro",
    // {
    //   text: "幻灯片",
    //   icon: "person-chalkboard",
    //   link: "https://ecosystem.vuejs.press/zh/plugins/markdown/revealjs/demo.html",
    // },
  ],
});
