---
title: I2C总线协议
icon: ic:sharp-developer-board
date: 2026-05-01
updated: 2026-05-01
tags:
  - hardware
---

# I2C总线协议

## SCL 和 SDL

SCL：Serial Clock Line，用于同步时钟信号，由主设备产生。

SDA：Serial Data Line，用于数据传输。

**注意：所有 SCL 和 SDA 引脚都应该设置为开漏输出（包括从机）**

## I2C 通信原理

1. 起始位
2. 7位地址+1位读写方向位（1读/0写）
3. 读写数据
4. 结束位

SCL 高电平表示 SDA 有数据。


