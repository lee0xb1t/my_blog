---
icon: mdi:cog
date: 2026-04-13
updated: 2026-04-13
tags:
  - irql
  - memory
  - mdl
  - paged
  - lookaside
  - windows
  - driver
---

# WDM教程4：内存管理

## 什么是分页内存？

操作系统的内存管理非常复杂，新手这里只需要记住一点：分页内存会将页面数据**交换到磁盘**，这就是意味着需要**读写磁盘**。

计算机的物理内存是有限的，所以`CPU`能够**对物理内存“虚拟化”**，使得每个进程都有独一份的内存空间。然而“虚拟化”的代价就是**缺页**，`CPU`的`MMU`（内存管理单元）在翻译虚拟地址时，如果发现**物理页不在内存中**，会触发**缺页中断**。

**缺页中断**的中断处理程序运行在`PASSIVE_LEVEL`，因为需要读取磁盘。这时高`IRQL`使得缺页中断不会被响应。

这就是为什么`DISPATCH_LEVEL`不能使用分页内存。

::: tip `分页内存`可以转化为`非分页内存`，代码如下：

```c
// 分页内存 → "临时非分页内存" 的转换过程
PVOID pagedBuffer = ExAllocatePoolWithTag(PagedPool, PAGE_SIZE, 'PgTg');
PMDL mdl = IoAllocateMdl(
    pagedBuffer,        // 要锁定的虚拟地址
    PAGE_SIZE,          // 大小
    FALSE,              // 主 MDL
    FALSE,              // 不分配额外资源
    NULL                // 不关联 IRP
);
__try {
    MmProbeAndLockPages(mdl, KernelMode, IoReadAccess);
    PVOID lockedAddress = MmGetSystemAddressForMdlSafe(mdl, NormalPagePriority);    
    // 安全地在 DISPATCH_LEVEL 使用
    // do somethings...
    MyDpcRoutine(lockedAddress);  // ✅ 安全
    MmUnlockPages(mdl);
} __except(EXCEPTION_EXECUTE_HANDLER) {
    // 处理异常（如内存不足）
}
// 最后记得释放 MDL
IoFreeMdl(mdl);
ExFreePool(pagedBuffer);
```

:::

## Pool Memory（池内存）

池内存是驱动程序动态申请内存的核心机制。由于环境特殊，池内存的分配比用户态更严格。代码如下：

```c
PVOID buffer = ExAllocatePoolWithTag(NonPagedPool, 4096, 'TSET');
```

内核池主要分为**分页内存 (PagedPool)**和**非分页内存 (NonPagedPool)**，如何选择取决于会被哪个`IRQL`层级的代码访问。

|标志|核心特征|使用场景|限制|
|-|-|-|-|
|NonPagedPool|永远驻留在物理内存，不会被交换到磁盘。|高`IRQL`访问，同步对象，内核对象。|**系统资源有限**，申请过多会导致系统内存耗尽。|
|PagedPool|会被内存管理换出到磁盘。|低 IRQL 访问：仅在 PASSIVE_LEVEL 下运行的代码（如 DriverEntry、IRP_MJ_CREATE 处理函数）。|**禁止**在 IRQL >= DISPATCH_LEVEL 下访问。|

## Lookaside List

某些场景需要**频繁的申请和释放固定大小内存**，这时可以使用`Lookaside`管理这类内存。代码如下:

```c
// 固定大小结构体
typedef struct _MY_DATA {
    LIST_ENTRY ListEntry;
    ULONG Value;
    WCHAR Name[64];
} MY_DATA, *PMY_DATA;

typedef struct _DEVICE_EXTENSION {
    NPAGED_LOOKASIDE_LIST NpLookaside;
    PAGED_LOOKASIDE_LIST PagedLookaside;
} DEVICE_EXTENSION, *PDEVICE_EXTENSION;

// 初始化函数
VOID InitializeLookasideLists(PDEVICE_EXTENSION DevExt) {
    // 初始化非分页 Lookaside 链表
    ExInitializeNPagedLookasideList(
        &DevExt->NpLookaside,
        NULL,                       // 自定义分配函数（通常用 NULL）
        NULL,                       // 自定义释放函数（通常用 NULL）
        0,                          // 标志（通常为 0）
        sizeof(MY_DATA),            // 固定块大小
        'NpLs',                     // 内存标签（用于调试）
        0                           // 深度（0 = 系统默认）
    );
    
    // 初始化分页 Lookaside 链表
    ExInitializePagedLookasideList(
        &DevExt->PagedLookaside,
        NULL,
        NULL,
        0,
        sizeof(MY_DATA),
        'PgLs',
        0
    );
    
    KdPrint(("Lookaside lists initialized\n"));
}

NTSTATUS DriverEntry(/*...*/) {
  //...
  InitializeLookasideLists(DevExt);

  for (int i = 0; i < 10000; i++) {
      PMY_STRUCT data = ExAllocateFromNPagedLookasideList(&DevExt->PagedLookaside);
      ExFreeToNPagedLookasideList(&DevExt->PagedLookaside, data);
  }
  // ...
}
```

使用场景:

* 固定大小网络包
* 固定大小内核对象

::: tip `Lookaside`的设计类似于`Linux`的`Slab`
读者如果有兴趣可以自行了解
:::

---

::: tip 版权声明
本文版权归 [lee0xb1t](https://github.com/lee0xb1t) 所有，未经许可不得以任何形式转载。
:::
