---
icon: heroicons:cpu-chip-20-solid
date: 2026-04-12
updated: 2026-04-12
tags:
  - data structure
  - windows
  - driver
---

# WDM教程6：内核中的数据结构

## 双向链表：LIST_ENTRY

内核链表的特点是需要将**链表指针嵌入到你自己的结构体中**，示例如下：

```c
typedef struct _MY_DATA {
    LIST_ENTRY ListEntry;   // 必须作为结构体成员
    ULONG Value;
} MY_DATA, *PMY_DATA;

LIST_ENTRY g_Head;
InitializeListHead(&g_Head); // 初始化链表头
```

基本操作：

```c
PMY_DATA data = ExAllocatePoolZero(NonPagedPool, sizeof(MY_DATA), 'MyDt');
InsertTailList(&g_Head, &data->ListEntry);      // 尾部插入
InsertHeadList(&g_Head, &data->ListEntry);      // 头部插入

PLIST_ENTRY entry = RemoveHeadList(&g_Head);    // 移除头部
data = CONTAINING_RECORD(entry, MY_DATA, ListEntry); // 重要：通过偏移找回父结构体

ExFreePool(data);
```

遍历和删除：

```c
KSPIN_LOCK lock;
KeInitializeSpinLock(&lock);

// 从头部移除
PLIST_ENTRY entry = ExInterlockedRemoveHeadList(&g_Head, &lock);
```

## 其他数据结构

原理都很简单，这里不再过多说明。

* KQUEUE：内核队列
    **标准生产者-消费者模式**，内核提供内置同步。
* 自旋锁保护的单链表：SINGLE_LIST_ENTRY 与 SLIST_HEADER
    如果在多线程环境中使用链表，建议使用 ExInterlockedPushEntryList 和 ExInterlockedPopEntryList。
    非常适合在高并发场景，比**LIST_ENTRY + 自旋锁的开销更低**。
* 哈希表：RTL_GENERIC_TABLE
* 稀疏位图：RTL_BITMAP
* 二叉平衡树：RTL_AVL_TABLE

---

::: tip 版权声明
本文版权归 [lee0xb1t](https://github.com/lee0xb1t) 所有，未经许可不得以任何形式转载。
:::
