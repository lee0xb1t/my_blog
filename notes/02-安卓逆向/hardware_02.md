---
title: Zygote进程
layout: page
icon: ic:sharp-developer-board
date: 2026-04-23
updated: 2026-04-23
tags:
  - kernel
  - android
  - zygote
---

## Zygote进程

`zygote`由`int`进程启动，它会初始化Java虚拟机（ART/Dalvik）和预加载公共系统资源等准备工作。

当需要启动一个新应用时，系统不是从零开始创建，而是让`zygote进程`通过`fork()`系统调用，快速地复制出一个子进程。每个新应用进程都从`zygote`那里继承了一个已经准备好的虚拟机环境和系统资源，大大缩短了应用启动时间。

Zygote孵化的第一个重要进程是SystemServer，它负责启动和管理Android系统的核心服务。

## app_process

文件系统并没有一个叫做`zygote`的可执行文件，`zygote`不是另一个可执行文件，而是`app_process`的一种运行模式。

`app_process`在检测到`--zygote`参数后，并不会创建新的进程，也不会执行新的`execve`。

它仍然是最初启动的`app_process`进程，只是在初始化过程中调用`set_process_name()`，该函数会通过`prctl(PR_SET_NAME)`修改内核维护的进程（线程）名称。

因此，用户看到的进程名变成了`zygote`，但进程本身（PID、地址空间、已加载的 ELF）并没有发生替换。

`app_process`位于`/system/bin/`目录下。

## ZygoteInit

`ZygoteInitZygoteInit`是Android系统中`Zygote`进程的`Java`层入口类。当`app_process`检测到`--zygote`时，会调用`com.android.internal.os.ZygoteInit.main`。

流程大致如下：

1. `init`进程启动`app_process`。

2. `app_process`中的`AndroidRuntime`启动虚拟机（ART/Dalvik）并注册`JNI函数`。
     - 创建`JavaVM`
     - 创建`JNIEnv`
     - 注册`Android Framework JNI`
     - 设置`ClassLoader`
     - 调用`Java main()`

3. `app_process`通过`JNI`调用`ZygoteInit.main()`方法。

## ZygoteInit主要工作

1. 预加载（Preloading）资源和类：这是Zygote最核心的优化之一，它会提前加载所有应用都会用到的公共类和资源。主要加载`/system/framework/`目录下的dex程序。
     这些预加载的类和资源，通过`Copy-on-Write (COW) 机制`被所有应用进程共享，极大地节省了内存和启动时间。

2. 监听`Socket`：
     获取并监听`init`创建的`zygote socket`，并开始监听来自`system_server（主要是AMS）`的请求。这个`socket`是`zygote`接收`孵化新进程命令`的通道。

3. 启动`Binder线程池`
    通过`nativeZygoteInit()`进入`Native`层，
    启动`Binder Thread Pool`，使`zygote`能参与Binder通信。

4. 进入无限循环，等待处理请求
     循环等待`socket`上的连接请求。当收到创建新应用进程的请求时，就会调用`fork()`来孵化新进程。

还有几个重要方法被调用：

- `Zygote.forkAndSpecialize()`：复制`zygote`自身进程，并定制化出一个全新的、拥有特定身份和权限的应用程序进程。

- `applicationInit()`：在fork出的子进程（普通应用进程）中调用，最终通过反射进入应用的`ActivityThread.main()`方法。

- `Zygote.forkSystemServer()`：创建`system_server`进程。

注意：

- `普通应用进程`最终会通过`RuntimeInit.applicationInit()`进入`ActivityThread.main()`。

- `system_server`进程则会调用`handleSystemServerProcess()`，最终进入`com.android.server.SystemServer.main()`。
