---
icon: mdi:cog
date: 2026-04-16
updated: 2026-04-16
tags:
  - windows
  - driver
---

# WDM教程7：驱动间调用

## 获取目标设备指针

```c
PDEVICE_OBJECT targetDevice = NULL;
PFILE_OBJECT fileObject = NULL;
NTSTATUS status;

// 1. 通过设备名称获取设备指针
UNICODE_STRING targetDeviceName = RTL_CONSTANT_STRING(L"\\Device\\TargetDevice");
status = IoGetDeviceObjectPointer(
    &targetDeviceName,
    FILE_ALL_ACCESS,
    &fileObject,
    &targetDevice
);

if (!NT_SUCCESS(status)) {
    return status;
}

// 2. 使用 targetDevice 进行调用...

// 3. 使用完毕后必须解除引用
ObDereferenceObject(fileObject);
```

## 同步调用

* `IoBuildDeviceIoControlRequest`：最常用的方式，用于发送同步的IOCTL请求。

```c
KEVENT event;
IO_STATUS_BLOCK ioStatus;
PIRP irp;
NTSTATUS status;

// 1. 初始化事件
KeInitializeEvent(&event, NotificationEvent, FALSE);

// 2. 构造同步IRP
irp = IoBuildDeviceIoControlRequest(
    IOCTL_MY_CODE,           // IOCTL码
    targetDevice,            // 目标设备
    inputBuffer,             // 输入缓冲区
    inputBufferSize,         // 输入缓冲区大小
    outputBuffer,            // 输出缓冲区
    outputBufferSize,        // 输出缓冲区大小
    FALSE,                   // 非内部IOCTL
    &event,                  // 用于等待的事件
    &ioStatus                // 返回I/O状态
);

if (irp == NULL) {
    return STATUS_INSUFFICIENT_RESOURCES;
}

// 3. 发送IRP
status = IoCallDriver(targetDevice, irp);

// 4. 关键步骤：如果返回STATUS_PENDING，必须等待事件
if (status == STATUS_PENDING) {
    KeWaitForSingleObject(&event, Executive, KernelMode, FALSE, NULL);
    status = ioStatus.Status; // 真正的状态在IoStatusBlock中
}

// 注意：此方式构造的IRP，I/O管理器会自动释放，无需手动调用IoFreeIrp
```

* `IoBuildSynchronousFsdRequest`：专门用于同步的文件系统读写、刷新、关闭等请求，例如构造一个`IRP_MJ_READ`并等待完成。

```c
irp = IoBuildSynchronousFsdRequest(
    IRP_MJ_READ,            // 主功能码
    targetDevice,           // 目标设备
    buffer,                 // 数据缓冲区
    length,                 // 数据长度
    &startingOffset,        // 起始偏移（对磁盘）
    &event,                 // 事件
    &ioStatus               // I/O状态块
);
// ... 发送和等待逻辑同上
```

## 异步调用

调用方在发送`IRP`后立即返回，不等待其完成。为了在`IRP`最终完成时得到通知并进行清理，调用方必须为`IRP`设置一个完成例程。无论底层驱动是同步还是异步处理，异步调用都不需要等待。

* `IoBuildAsynchronousFsdRequest`：用于发送异步的文件系统请求。必须设置完成例程，并在其中调用`IoFreeIrp`来释放`IRP`，否则会造成内存泄漏。

```c
PIRP irp;
irp = IoBuildAsynchronousFsdRequest(
    IRP_MJ_READ,            // 主功能码
    targetDevice,           // 目标设备
    buffer,                 // 缓冲区
    length,                 // 长度
    &startingOffset,        // 起始偏移
    &ioStatus               // I/O状态块
);

if (irp == NULL) {
    return STATUS_INSUFFICIENT_RESOURCES;
}

// 1. 必须设置完成例程
IoSetCompletionRoutine(
    irp, 
    MyAsyncCompletionRoutine, // 你的完成例程
    NULL, 
    TRUE, TRUE, TRUE
);

// 2. 发送IRP，立即返回
status = IoCallDriver(targetDevice, irp);

// 3. 不要等待，直接返回
return status;
```

## 手动构造IRP：IoAllocateIrp

```c
// 1. 分配IRP，栈大小需要至少能容纳目标驱动的参数
PIRP irp = IoAllocateIrp(targetDevice->StackSize, FALSE);
if (irp == NULL) {
    return STATUS_INSUFFICIENT_RESOURCES;
}

// 2. 获取下一个栈位置并手动填充
PIO_STACK_LOCATION nextStack = IoGetNextIrpStackLocation(irp);
nextStack->MajorFunction = IRP_MJ_DEVICE_CONTROL;
nextStack->Parameters.DeviceIoControl.IoControlCode = IOCTL_MY_CODE;
// ... 填充其他参数 ...

// 3. (可选) 设置完成例程
IoSetCompletionRoutine(irp, MyCompletionRoutine, NULL, TRUE, TRUE, TRUE);

// 4. 发送IRP
NTSTATUS status = IoCallDriver(targetDevice, irp);

// 5. 手动构造的IRP，必须由驱动负责清理
//    对于同步调用，在等待完成后调用IoFreeIrp。
//    对于异步调用，在完成例程中调用IoFreeIrp。
```

---

::: tip 版权声明
本文版权归 [lee0xb1t](https://github.com/lee0xb1t) 所有，未经许可不得以任何形式转载。
:::
