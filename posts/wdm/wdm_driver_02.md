---
title: WDM教程2：驱动数据类型和调试输出
icon: mdi:cog
date: 2026-04-11
updated: 2026-04-11
tags:
  - irql
  - primitive type
  - print
  - windows
  - driver
---

# WDM教程2：驱动数据类型和调试输出

## 基本类型

WDK 重定义了C语言的基础类型。比如 `ULONG` 代表 `unsigned long`，`UCHAR` 代表 `unsigned char`。这样做是为了保证数据类型在不同平台不同编译器的一致性。

PVOID：代表 `void*`

### NTSTATUS

WDK 用 `NTSTATUS` 表示函数执行结果，而非简单布尔值。这能够精确描述操作结果（如成功，资源不足，参数无效等）。**可以使用 NT_SUCCESS(status) 判断返回值是否成功**

## 字符串

WDK 不使用C语言原生的 `char*` 或 `wchar_t*` 作为字符串。而是使用 `UNICODE_STRING` 结构体。它由**缓冲区，当前长度，最大长度**三部分组成，可以更安全的管理字符串，防止内存溢出。定义如下：

```c
typedef struct _UNICODE_STRING {
    USHORT Length;        // 字符串当前字节长度（不含结尾空字符）
    USHORT MaximumLength; // 缓冲区总字节长度
    PWSTR  Buffer;        // 指向宽字符字符串的指针
} UNICODE_STRING, *PUNICODE_STRING;
```

为了方便，一般使用 `RTL_CONSTANT_STRING(L"Hello")` 宏来初始化常量字符串。

::: warning `UNICODE_STRING`使用时可能会涉及内存申请，要格外小心
`RTL_CONSTANT_STRING`宏可以申请常量字符串，所以是只读的，不能释放。
`DISPATCH_LEVEL`下不能使用分页内存，可以使用**非分页内存初始化字符串**或使用常量字符串。
`RtlInitUnicodeString`的内存取决于它的第二个参数`SourceString`。
:::

## 调试输出

### DbgPrint

用法和C语言`printf`类似，兼容大部分`printf`语法：[规范](https://learn.microsoft.com/zh-cn/cpp/c-runtime-library/format-specification-syntax-printf-and-wprintf-functions)。

::: warning `Unicode` 格式（%C、%S、%lc、%ls、%wc、%ws和 %wZ）只能与`IRQL = PASSIVE_LEVEL`一起使用。
这是最常见的陷阱，如果在`DISPATCH_LEVEL`打印`Unicode`，可能会BSOD。
DbgPrint **不支持任何浮点类型**（%f、%e、%E、%g、%G、%a或 %A）。
:::

### KdPrint

`KdPrint`是对`DbgPrint`的**宏封装**，仅在`Debug`模式下生效，使用`Release`编译时会被优化掉，语法必须使用双括号，如下所示：

```c
KdPrint(("Hello, Driver!"));
```

---

::: tip 版权声明
本文版权归 [lee0xb1t](https://github.com/lee0xb1t) 所有，未经许可不得以任何形式转载。
:::
