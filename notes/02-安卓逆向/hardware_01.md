---
title: INIT进程
layout: page
icon: ic:sharp-developer-board
date: 2026-04-23
updated: 2026-04-23
tags:
  - kernel
  - android
---

## android source在线

[https://xrefandroid.com/](https://xrefandroid.com/)

## init进程

`init进程`是android的第一个`用户空间进程`，**它的进程编号永远为1**。当linux初始化完内核后，运行的第一个程序是`/init（大多数情况下的路径，一般通过内核命令行参数指定）`。

它也是所有进程的祖先进程，负责启动和管理其余部分。

对于其他的linux发行版，它们的init进程大多是`systemd`。

## 启动流程

### 早期架构

1. `boot.img`包含一个`ramdisk（一个压缩文件，通常是cpio格式）`，其中包含`/init`程序以及启动所需的配置文件（如 `init.rc`）。

2. linux在启动中已经创建好了一个内存中的`rootfs（根文件系统）`。内核将`boot.img`中的`ramdisk（CPIO压缩包）`解压，并展开到内存中的`rootfs（即initramfs环境）`，形成早期所需要的用户空间环境。接着执行`/init`程序。
  
    与传统Linux发行版不同，Android通常不会执行`switch_root`将`rootfs`切换到磁盘文件系统，而是在当前`rootfs`基础上挂载system、vendor、product等Android分区。
  
    `system-as-root`是例外，它会将`system.img`挂载到`/`。

3. `init`负责挂载基础虚拟文件系统：
    - `/dev`：tmpfs，由init挂载，并启动`ueventd`，随后`ueventd`根据`kernel uevent`创建设备节点。
    - `/proc`：procfs。
    - `/sys`：sysfs。

4. 有了设备节点后，`init`会读取`fstab`挂载system、vendor、product等Android所需分区，并完成用户空间初始化。
    - `/system`： system.img
    - `/vendor`： vendor.img

5. 加载`SELinux policy`，从`/system`或`/vendor`分区中读取`SELinux`策略文件并加载。

### SAR 架构

Android 10开始，新发布设备必须采用`System-as-Root（SAR）`架构。与传统架构不同，SAR将`system.img`作为最终的根文件系统`/`，而不是仅仅挂载到 `/system` 目录。

1. `boot.img` 仍然包含 `kernel` 和 `ramdisk`。
   Linux启动后创建内存中的`rootfs`，并将`ramdisk`解压到其中，然后执行`/init`。

2. `ramdisk`中的`init`进入`First Stage Init`。
  `First Stage Init`主要负责：
    - 挂载`/proc`、`/sys`。
    - 初始化`/dev` 环境。
    - 初始化`device mapper`。
    - 根据`fstab`中`first_stage_mount`标记挂载system、vendor等必要分区。
    - 准备`selinux`环境。

3. 随后`init`从system、vendor、product等分区读取`SELinux policy`文件并加载策略。

4. 完成早期初始化后，`init`执行`root`切换，将根目录从临时`ramdisk rootfs`切换到`system`分区。

5. 切换完成后，`init`再次执行 `/init`，进入`Second Stage Init`。

6. `Second Stage Init`：
   - 挂载剩余Android分区：
       - system_ext
       - vendor
       - product
       - odm
   - 解析`init.rc`。
   - 启动`zygote`、`servicemanager`等核心服务。

## init.rc文件格式

- `on（动作）`
    定义了一组命令，这些命令会在特定触发器 (trigger) 条件满足时执行。
    语法：`on <trigger> <command1> <command2> ...`

- `service（服务）`
    定义了一个在系统启动时运行或重启的可执行程序。
    语法：

    ```text
    service <name> <pathname> [ <argument> ]*
     <option1>
     <option2>
     ...
    ```

- 所有动作：

    | Trigger | 作用 |
    | --- | --- |
    | `early-init` | 最早初始化阶段 |
    | `init` | 创建目录、设置基础环境 |
    | `late-init` | 触发后续启动流程 |
    | `early-fs` | 早期文件系统初始化 |
    | `fs` | 挂载文件系统分区 |
    | `post-fs` | 文件系统挂载后的处理 |
    | `post-fs-data` | `/data` 分区准备完成后的处理 |
    | `boot` | 正常启动阶段 |
    | `charger` | 充电模式启动 |
    | `nonencrypted` | 非加密设备启动流程 |
    | `property:*` | 根据系统属性变化触发 Action |
    | `shutdown` | 关机流程 |
    | `zygote-start` | 启动 Zygote 进程 |

- 示例：

    ```text
    on early-init
    start ueventd
    setrlimit 8 0 9223372036854775807
    ```

## Magisk原理

Magisk这类工具就是通过修改`boot.img`中的`ramdisk`，将`init`程序替换为`自己的init`，实现劫持。

## poroprty_service

`property_service`是`Android`系统的核心服务，它管理着整个系统的`属性（Properties）`。一个全局的、字符串类型的键值对（Key-Value）数据库。

它运行在`init`进程（PID 1）内部，负责存储和管理所有系统级的配置和状态信息。每个属性由一个键（Key）和一个值（Value）组成，且值必须是字符串格式。
