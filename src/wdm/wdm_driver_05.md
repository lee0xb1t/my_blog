---
icon: heroicons:cpu-chip-20-solid
date: 2026-04-12
updated: 2026-04-12
tags:
  - timer
  - sync
  - dpc
  - windows
  - driver
---

# WDM教程5：内核同步机制

## Lock

* Spin Lock
* Queued Spin Lock
* Fast Mutex
* Kernel Mutex
* ERESOURCE
* Push Lock
* Guarded Mutex

## DPC

**DPC（Deferred Procedure Call，延迟过程调用）**是 Windows 内核中用于将高`IRQL`的工作“降级”到稍低的`DISPATCH_LEVEL`执行的机制。它最典型的应用场景是：在**ISR（中断服务例程）**中快速响应硬件，然后将耗时的数据处理工作推迟到`DPC`中完成。

* ISR（中断服务例程）：运行在`DIRQL`，屏蔽了大部分系统中断，必须极快返回。
* DPC 例程：运行在`DISPATCH_LEVEL`，虽仍**不能等待**，但可以调用大部API。

```c
// 1. 在设备扩展中声明 DPC 对象
typedef struct _DEVICE_EXTENSION {
    KDPC Dpc;               // DPC 对象本身
    // ... 其他数据
} DEVICE_EXTENSION, *PDEVICE_EXTENSION;

// 2. 初始化 DPC（通常在 DriverEntry 或 AddDevice）
VOID InitializeDpc(PDEVICE_EXTENSION DevExt) {
    // 关联 DPC 对象与回调函数
    KeInitializeDpc(
        &DevExt->Dpc,               // DPC 对象
        MyDpcRoutine,               // 回调函数
        DevExt                      // 传给回调的上下文参数
    );
    
    // 可选：设置 DPC 的重要性（影响调度优先级）
    // KeSetImportanceDpc(&DevExt->Dpc, HighImportance);
}

// 在 ISR 中请求 DPC（典型用法）
BOOLEAN MyIsrRoutine(
    _In_ PKINTERRUPT Interrupt,
    _In_ PVOID ServiceContext
) {
    PDEVICE_EXTENSION DevExt = (PDEVICE_EXTENSION)ServiceContext;
    
    // 1. 快速处理硬件（读取状态、清除中断标志）
    // ...
    
    // 2. 请求 DPC 执行
    //    第二个参数为 NULL 表示在当前 CPU 上排队
    KeInsertQueueDpc(&DevExt->Dpc, NULL, NULL);
    
    // 3. 返回 TRUE 表示这是我们设备的中断
    return TRUE;
}

// DPC 回调函数
VOID MyDpcRoutine(
    _In_ PKDPC Dpc,
    _In_opt_ PVOID DeferredContext,
    _In_opt_ PVOID SystemArgument1,
    _In_opt_ PVOID SystemArgument2
) {
    PDEVICE_EXTENSION DevExt = (PDEVICE_EXTENSION)DeferredContext;
    
    // 当前 IRQL = DISPATCH_LEVEL
    // ✅ 可以做：复制内存、操作硬件寄存器、设置事件、提交 Work Item
    // ❌ 不能做：等待对象（KeWaitForXxx）、访问分页内存
    
    KdPrint(("DPC: Processing deferred work\n"));
    
    // 典型后续：如果需要做文件 I/O 或等待，则提交 Work Item 到 PASSIVE_LEVEL
    // IoQueueWorkItem(...);
}
```

## 对象等待

允许一个线程主动让出 CPU，等待某个事件（如 I/O 完成、定时器到期、信号量触发）发生后再恢复执行。

```c
KeWaitForSingleObject(&Event, Executive, KernelMode, FALSE, NULL);
```

定义如下：

```c
NTSTATUS KeWaitForSingleObject(
    _In_ PVOID Object,           // 要等待的对象指针
    _In_ KWAIT_REASON WaitReason, // 等待原因
    _In_ KPROCESSOR_MODE WaitMode, // KernelMode 或 UserMode
    _In_ BOOLEAN Alertable,      // 是否可警醒
    _In_opt_ PLARGE_INTEGER Timeout // 超时时间（NULL = 无限等待）
);
```

### Alertable

`Alertable`参数控制等待期间线程是否**可接收 APC（Asynchronous Procedure Call，异步过程调用）**，若`APC`被投递，`KeWaitForSingleObject`会立即返回。有以下几种情况：

* 用户态`APC`
* 内核态`APC`
* 线程被强制唤醒（`NtAlertThread`）

### 可等待的内核对象

* KEVENT (事件) - 最常用
* KSEMAPHORE (信号量)
* KMUTEX (互斥体)
* KTIMER (定时器)
* KTHREAD (线程)
* KPROCESS (进程)
* FILE_OBJECT (文件对象，I/O 完成时触发)

#### KEVENT

```c
// 同步事件 (Synchronization Event) - 自动重置
// 释放一个等待线程后自动变为无信号状态
KEVENT syncEvent;
KeInitializeEvent(&syncEvent, SynchronizationEvent, FALSE);

// 通知事件 (Notification Event) - 手动重置
// 释放所有等待线程，必须手动重置
KEVENT notifyEvent;
KeInitializeEvent(&notifyEvent, NotificationEvent, FALSE);

KeSetEvent(&syncEvent, IO_NO_INCREMENT, FALSE);
```

::: warning `KeSetEvent`可以在`IRQL <= DISPATCH_LEVEL`调用
但如果`Wait = TRUE`，必须在`IRQL <= APC_LEVEL`且持有非原子锁时调用。
在`IRQL = PASSIVE_LEVEL`上运行的**可分页线程或可分页驱动程序例程**绝不应将`Wait`参数设置为`TRUE`。如果调用方碰巧在调用`KeSetEvent`和`KeWaitXxx`之间分页，则此类调用会导致页面错误。
:::

#### KTIMER

```c
KTIMER g_timer;
KDPC g_dpc;
LARGE_INTEGER interval;

// 初始化定时器 (也可以用 KeInitializeTimerEx)
KeInitializeTimer(&g_timer);
// 初始化 DPC，关联回调函数
KeInitializeDpc(&g_dpc, MyTimerDpcRoutine, NULL);
// 设置 1 秒间隔（负值表示相对时间，单位 100 纳秒）
interval.QuadPart = -10000 * 1000; 
// 第三个参数是周期(毫秒)，设为0则为单次触发；这里设置周期为 1000ms
KeSetTimerEx(&g_timer, interval, 1000, &g_dpc); 
KTIMER g_timer;
KDPC g_dpc;
LARGE_INTEGER interval;

// 初始化定时器 (也可以用 KeInitializeTimerEx)
KeInitializeTimer(&g_timer);
// 初始化 DPC，关联回调函数
KeInitializeDpc(&g_dpc, MyTimerDpcRoutine, NULL);

KeCancelTimer(&g_timer); // 取消定时器，确保 DPC 不会再被触发
```

::: warning `KTIMER`和`KDPC`对象必须存放在非分页内存 (`NonPagedPool`) 中，因为它们的回调函数执行在`DISPATCH_LEVEL` 。
如果卸载时定时器关联的`DPC`还排队等待执行，直接`KeCancelTimer`是不够的。安全做法是调用`KeFlushQueuedDpcs()`来强制清理所有排队中的`DPC`，否则极易导致蓝屏死锁。
:::

## WorkItem

内核中用于延迟执行的一种机制。如果一个耗时操作无法在当前环境下安全执行的任务，交给系统工作线程在合适的**低IRQL(PASSIVE_LEVEL)**环境下处理 。

### I/O Work Item（推荐，与设备对象关联）

```c
PIO_WORKITEM IoAllocateWorkItem(PDEVICE_OBJECT DeviceObject);
VOID IoQueueWorkItem(
    [in] PIO_WORKITEM IoWorkItem,
    [in] PIO_WORKITEM_ROUTINE WorkerRoutine,
    [in] WORK_QUEUE_TYPE QueueType,  // Critical/Delayed/HyperCritical
    [in, optional] PVOID Context
);
VOID IoFreeWorkItem(PIO_WORKITEM IoWorkItem);
```

### Executive Work Item（通用，无设备关联）

```c
VOID ExInitializeWorkItem(
    [out] PWORK_QUEUE_ITEM WorkItem,
    [in]  PWORKER_THREAD_ROUTINE Routine,
    [in]  PVOID Context
);
VOID ExQueueWorkItem(
    [in] PWORK_QUEUE_ITEM WorkItem,
    [in] WORK_QUEUE_TYPE QueueType
);
```

### 工作线程队列类型

|队列类型|含义|用途|
|-|-|-|
|CriticalWorkQueue|关键工作队列|短时间、高优先级任务|
|DelayedWorkQueue|延迟工作队列|长时间、低优先级任务|
|HyperCriticalWorkQueue|超关键队列|系统关键任务（极少使用）|

示例代码：

```c
typedef struct _WORK_CONTEXT {
    PIO_WORKITEM WorkItem;
    PUCHAR DataBuffer;
    ULONG DataLength;
} WORK_CONTEXT, *PWORK_CONTEXT;

// 1. DPC 例程（DISPATCH_LEVEL）
VOID MyDpcRoutine(
    PKDPC Dpc,
    PVOID DeferredContext,
    PVOID SystemArgument1,
    PVOID SystemArgument2
) {
    PDEVICE_OBJECT DeviceObject = (PDEVICE_OBJECT)DeferredContext;
    
    // 分配工作项和上下文（DISPATCH_LEVEL 允许）
    PWORK_CONTEXT Context = ExAllocatePool2(POOL_FLAG_NON_PAGED, 
                                            sizeof(WORK_CONTEXT), 
                                            'tag1');
    PIO_WORKITEM WorkItem = IoAllocateWorkItem(DeviceObject);
    
    Context->WorkItem = WorkItem;
    Context->DataBuffer = SystemArgument1;
    Context->DataLength = (ULONG)(ULONG_PTR)SystemArgument2;
    
    // 投递到工作线程，立即返回
    IoQueueWorkItem(WorkItem, 
                    MyWorkItemRoutine, 
                    DelayedWorkQueue,  // 长时间操作使用延迟队列
                    Context);
}

// 2. 工作线程回调（PASSIVE_LEVEL - 安全执行 I/O）
VOID MyWorkItemRoutine(
    PDEVICE_OBJECT DeviceObject,
    PVOID Context
) {
    PWORK_CONTEXT WorkContext = (PWORK_CONTEXT)Context;
    
    // 现在可以安全地：
    // 1. 访问分页内存
    // 2. 执行文件 I/O
    // 3. 等待事件/信号量
    
    HANDLE FileHandle;
    IO_STATUS_BLOCK IoStatus;
    OBJECT_ATTRIBUTES ObjAttr;
    
    // 文件操作示例...
    ZwCreateFile(&FileHandle, ...);
    ZwWriteFile(FileHandle, NULL, NULL, NULL, &IoStatus, 
                WorkContext->DataBuffer, WorkContext->DataLength, 
                NULL, NULL);
    ZwClose(FileHandle);
    
    // 清理
    IoFreeWorkItem(WorkContext->WorkItem);
    ExFreePool(WorkContext);
}
```

## 不同IRQL下的同步

|IRQL级别|可用同步机制|等待特性|场景|
|-|-|-|-|
|**PASSIVE_LEVEL (0)**|`KeWaitForXxx`, `Mutex`, `Event`, `Semaphore`, `Resource`, ...|**可以阻塞等待**|线程上下文、Work Item|
|**APC_LEVEL (1)**|`SpinLock`, `InterlockedXxx`|**不能等待，只能自旋**|APC 例程|
|**DISPATCH_LEVEL (2)**|`SpinLock`, `InterlockedXxx`|**不能等待，只能自旋**|DPC、定时器回调|
|**DIRQL (3-26)**|`SpinLock`(与中断关联)|**不能等待，只能自旋**|ISR|

---

::: tip 版权声明
本文版权归 [lee0xb1t](https://github.com/lee0xb1t) 所有，未经许可不得以任何形式转载。
:::
