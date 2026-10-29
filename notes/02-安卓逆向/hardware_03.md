---
title: SystemServer
layout: page
icon: ic:sharp-developer-board
date: 2026-04-23
updated: 2026-04-23
tags:
  - kernel
  - android
  - zygote
  - system_server
---

## system_server

`system_server`负责启动和管理`android核心系统服务`。

### 早期服务

`ActivityManagerService (AMS)`：活动管理器服务，管理所有应用组件的生命周期、任务栈等。

`PackageManagerService (PMS)`：包管理器服务，负责管理所有已安装的 APK 包，如安装、卸载、解析等。

`WindowManagerService (WMS)`：窗口管理器服务，管理所有窗口的创建、布局和排序。

`PowerManagerService`：电源管理器服务，负责系统的电源状态管理和唤醒锁等。

### 核心服务

`BatteryService`：电池服务，监控和报告电池状态。

`ConnectivityService`：连接服务，管理网络连接（Wi-Fi, 蜂窝数据等）。

`NetworkPolicyManagerService`：网络策略管理服务。

`NetworkStatsService`：网络统计服务。

### 其他系统服务

`AccountManagerService`：账户管理服务，管理用户的在线账户。

`AccessibilityManagerService`：无障碍服务，为辅助功能提供支持。

`AlarmManagerService`：闹钟管理服务。

`AppWidgetService`：应用小部件服务。

`AudioService`：音频服务，管理系统的音频路由和策略。

`BackupManagerService`：备份管理服务。

`BluetoothService`和`BluetoothA2dpService`：蓝牙服务。

`ClipboardService`：剪贴板服务。

`ContentService`：内容服务，管理 ContentProvider。

`DeviceStorageMonitorService`：设备存储监控服务。

`DockObserver`：底座观察者，处理设备插拔底座事件。

`DropBoxManagerService`：DropBox 服务，用于系统错误日志记录。

`HardwareService`：硬件服务。

`InputMethodManagerService`：输入法管理服务。

`LightsService`：灯光服务，控制 LED 指示灯等。

`LocationManagerService`：位置管理服务。

`MountService`：挂载服务，管理存储设备的挂载。

`NotificationManagerService`：通知管理服务。

`RecognitionManagerService`：识别管理服务。

`SearchManagerService`：搜索管理服务。

`SensorService`：传感器服务，管理各种硬件传感器。

`StatusBarManagerService`：状态栏管理服务。

`TelephonyRegistry`：电话注册服务，管理电话状态监听。

`ThrottleService`：限速服务。

`UiModeManagerService`：UI 模式管理服务。

`UsbService`：USB 服务，管理 USB 连接和模式。

`WallpaperService`：壁纸服务。

`Watchdog`：看门狗服务，用于检测系统死锁并重启。

`WifiService`和`WifiP2pService`：Wi-Fi 和 Wi-Fi P2P 服务。

`UiModeManagerService`：UI模式管理服务。

注意：以上列表并非全部，且不同 Android 版本的服务列表会有所增减。

## Binder IPC

`system_server`与其他进程（如应用进程）的交互，几乎完全依赖`Binder IPC`机制。

主要流程：

1. 启动`Binder线程池`

     `system_server`进程在启动初期，会通过`nativeZygoteInit()`方法初始化并启动一个`Binder线程池`。这使得`system_server`具备了随时接收和处理来自其他进程的`Binder IPC`请求的能力。

2. 服务注册与发现

     `system_server`中的众多系统服务（如 ActivityManagerService、PackageManagerService 等）在启动后，会将自己的`Binder接口注册到`一个名为`ServiceManager`的全局服务管理器中。其他进程就可以通过`ServiceManager`查询并获取到所需服务的`代理对象`。

3. 跨进程调用

     当一个应用进程需要调用系统服务（例如，通过 startActivity() 启动一个新界面）时，它实际上是通过之前获取的`Binder代理对象（Proxy）`发起调用。这个调用请求会被`Binder驱动接管`，并传递给`system_server`进程中`真正的服务实现对象（Binder 实体）`去执行。

## servicemanager

这是一个由`init`进程在系统启动早期通过`init.rc`脚本启动的`原生（Native）守护进程`。位于`/system/bin/servicemanager`（或`vendor/bin/hwservicemanager`等变体）。

它负责管理所有系统服务的`Binder引用`，让其他进程能通过服务名称（如 "activity"）找到对应的`Binder句柄`。

客户端（App）从`servicemanager`拿到句柄后，直接通过`Binder 驱动`与目标服务所在的进程（比如system_server）通信。

`AndroidManifest.xml`中声明的`<service>`组件，就是通过`Binder 机制`来提供`跨进程通信（IPC）`能力的。

### SDK中的ServiceManager类

在Android SDK和Framework的Java层，有一个`android.os.ServiceManager`类。它不是一个进程，而是一个辅助工具类。当App调用`ServiceManager.getService("activity")`时，这个Java类内部会通过`Binder IPC`向真正的servicemanager进程（句柄为0）发起查询请求，获取远程服务的`代理对象（IBinder）`。
