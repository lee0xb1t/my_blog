---
icon: heroicons:cpu-chip-20-solid
date: 2026-04-11
updated: 2026-04-11
tags:
  - irql
  - apic
  - interrupt
  - windows
  - driver
---

# WDM教程2：HelloWorld 驱动和基础结构体

## 什么是WDM？

WDM（Windows Driver Model，Windows驱动模块）是微软公司推出的一套驱动程序设计规范，主要应用于Windows 98、Me和2000以及之后的操作系统。它的目标是让一个驱动程序能够在不同版本的Windows上运行，并实现对即插即用（PnP）和电源管理功能的统一支持。

## 与WDF区别

WDF 极大简化了驱动开发，开发者不需要处理繁琐的同步等问题，是现代驱动开发的首选。

## WDM特点

1. **跨平台兼容**：可以在不同的Windows系统运行
2. **即插即用支持**：系统自动检测硬件、分配资源
3. **分层结构**：设备栈设计，将请求分配给不同驱动层
4. **电源管理**：驱动能够相应电源和系统变化，实现休眠等功能

### 分层驱动模型

|驱动类型|功能|提供方|
|:-----|-----|:-----:|
|**过滤驱动**|用于监控和修改设备行为|第三方开发者|
|**功能驱动**|负责设备操作和控制逻辑|设备厂商|
|**总线驱动**|管理物理总线（PCI, USB），枚举设备并向上层提供接口|微软|

### 开发流程

1. 搭建环境：Visual Studio 和 WDK（Windows Driver Kit）
2. 编写代码：入口函数为`DriverEntry`，**创建设备**和**添加功能回调**
3. 处理I/O请求：`IRP_MJ_xxxx` 回调
4. INF文件：驱动的设备ID、名称、版本等，在这个文件定义
5. 测试和调试：使用虚拟机进行双机测试，使用Windbg工具进行动态调试

## 设备栈

设备栈（Device Stack）的架构概念之一，它是由多个设备对象组成的垂直分层结构，每个设备对象都有一个关联的应用程序。**设备栈最顶层靠经应用层，最底层靠近物理层**。

### 设备栈如何工作

IRP（I/O请求包）创建后，会从栈顶开始，沿着设备栈向下传递，直到最底层硬件处理它，完成后再逐层原路返回。

每一层处理 IRP 后，有三种选择：

* 向下传递
* 直接完成：如果自己能搞定，就调用 `IoCompleteRequest` 直接返回。
* 处理后在传递：先修改或做记录，再向下传递。

## HelloWorld驱动

1. Visual Studio 创建项目，选择 `KMDF, Empty`

    INF文件以及自动创建，可以直接按需修改
2. 创建`main.c`并写入以下代码

    ```c
    #include <wdm.h>

    VOID DriverUnload(PDRIVER_OBJECT DrvObj) {
        UNREFERENCED_PARAMETER(DrvObj);

        KdPrint(("Driver Unload!\n"));
    }

    NTSTATUS DriverEntry(PDRIVER_OBJECT DrvObj, PUNICODE_STRING RegistryPath) {
        UNREFERENCED_PARAMETER(RegistryPath);

        KdPrint(("Hello World!\n"));
        DrvObj->DriverUnload = DriverUnload;

        return STATUS_SUCCESS;
    }
    ```

3. `Ctrl+B` 编译

## DriverObject

结构体定义如下：

```c
typedef struct _DRIVER_OBJECT {
  CSHORT  Type;	// 驱动类型
  CSHORT  Size; // 驱动大小
  PDEVICE_OBJECT  DeviceObject; // 驱动对象
  ULONG  Flags; // 驱动的标志
  PVOID  DriverStart; // 驱动的起始位置
  ULONG  DriverSize; // 驱动的大小
  PVOID  DriverSection; // 指向驱动程序文件的内存区对象
  PDRIVER_EXTENSION  DriverExtension; // 驱动的扩展空间
  UNICODE_STRING  DriverName; // 驱动名字
  PUNICODE_STRING  HardwareDatabase;
  PVOID  FastIoDispatch;
  PDRIVER_INITIALIZE DriverInit;
  PDRIVER_STARTIO    DriverStartIo;
  PDRIVER_UNLOAD     DriverUnload; // 驱动对象的卸载地址
  PDRIVER_DISPATCH   MajorFunction[IRP_MJ_MAXIMUM_FUNCTION + 1];
} DRIVER_OBJECT;
```

接下来我会详细讲解每个成员的作用：

|成员|作用|使用场景|
|-|-|:------------------------------------------------|
|Type|对象类型标识，DRIVER_OBJECT 的固定类型值通常是 0x0004|通常不需要关心，由 I/O 管理器设置|
|Size|结构体大小，用于版本兼容性|I/O 管理器初始化时设置，可读取但不应修改|
|DeviceObject|指向驱动创建的第一个设备对象的指针，后续设备对象通过 `NextDevice` 链表连接|遍历该驱动的所有设备对象时使用|
|Flags|驱动行为标志，如 DO_BUFFERED_IO、DO_DIRECT_IO 等|在 DriverEntry 中设置，影响 I/O 操作方式|
|DriverStart|驱动代码在内存中的加载基址|调试时使用，可用于计算代码偏移|
|DriverSize|驱动映像文件的大小（字节）|调试、安全检查|
|DriverSection|指向驱动模块的内存区对象（内部使用）|基本不用于驱动开发，由系统管理|
|DriverExtension|指向驱动的扩展结构，包含额外信息|访问驱动服务名称、加载顺序等|
|DriverName|驱动服务名称，如 \Driver\MyDriver|调试输出、日志记录|
|HardwareDatabase|指向注册表中硬件配置信息的路径||
|FastIoDispatch|指向 FAST_IO_DISPATCH 结构体的指针，用于快速 I/O 路径|文件系统驱动必须设置，普通 PNP 驱动通常为 NULL|
|DriverInit|驱动的入口点函数地址（DriverEntry）|由 I/O 管理器调用，驱动一般不访问|
|DriverStartIo|串行化 I/O 的回调函数地址|需要串行处理 I/O 时设置（如磁盘驱动）|
|DriverUnload|驱动的卸载回调函数地址|必须实现，用于清理资源|
|MajorFunction|IRP 派发函数表，处理各种 I/O 请求|必须设置，每个支持的 IRP 类型都需要注册回调|

### DeviceObject 与设备链表

```c
PDEVICE_OBJECT devObj = driverObject->DeviceObject;
while (devObj) {
    KdPrint(("设备对象: %p\n", devObj));
    devObj = devObj->NextDevice;  // 链表遍历
}
```

### MajorFunction

用于和用户层通信

```c
DriverObject->MajorFunction[IRP_MJ_CREATE] = MyDispatchCreate;
DriverObject->MajorFunction[IRP_MJ_CLOSE] = MyDispatchClose;
DriverObject->MajorFunction[IRP_MJ_READ] = MyDispatchRead;
DriverObject->MajorFunction[IRP_MJ_WRITE] = MyDispatchWrite;
DriverObject->MajorFunction[IRP_MJ_DEVICE_CONTROL] = MyDispatchDeviceControl;
DriverObject->MajorFunction[IRP_MJ_PNP] = MyDispatchPnp;
DriverObject->MajorFunction[IRP_MJ_POWER] = MyDispatchPower;

// 不支持的请求可以指向默认处理函数
for (int i = 0; i <= IRP_MJ_MAXIMUM_FUNCTION; i++) {
    if (DriverObject->MajorFunction[i] == NULL) {
        DriverObject->MajorFunction[i] = MyDispatchInvalid;
    }
}
```

### 初始化流程

```c
NTSTATUS DriverEntry(PDRIVER_OBJECT DriverObject, PUNICODE_STRING RegistryPath)
{
    // 1. 设置卸载函数（必须）
    DriverObject->DriverUnload = DriverUnload;
    
    // 2. 设置 IRP 派发函数
    DriverObject->MajorFunction[IRP_MJ_CREATE] = DispatchCreate;
    DriverObject->MajorFunction[IRP_MJ_CLOSE] = DispatchClose;
    DriverObject->MajorFunction[IRP_MJ_DEVICE_CONTROL] = DispatchIoControl;
    DriverObject->MajorFunction[IRP_MJ_PNP] = DispatchPnp;
    DriverObject->MajorFunction[IRP_MJ_POWER] = DispatchPower;
    
    // 3. 设置标志（可选）
    DriverObject->Flags |= DO_BUFFERED_IO;
    
    // 4. 创建设备对象
    // ... WdfDeviceCreate 或 IoCreateDevice
    
    return STATUS_SUCCESS;
}
```

### DriverStartIo

WDM 的 I/O 处理例程（也就是指定的 `IRP` 函数）**默认并行执行**，因此 IRP 例程需要自己处理并发。

当设备需要 **串行化处理 IRP**（如单通道硬件、必须序列操作）时，DriverStartIo 是 WDM 提供的一种经典串行化机制。

DriverStartIo 的**类型**定义如下：

```c
_Function_class_(DRIVER_STARTIO)
_IRQL_always_function_min_(DISPATCH_LEVEL)
_IRQL_requires_(DISPATCH_LEVEL)
_IRQL_requires_same_
typedef
VOID
DRIVER_STARTIO (
    _Inout_ struct _DEVICE_OBJECT *DeviceObject,
    _Inout_ struct _IRP *Irp
    );

typedef DRIVER_STARTIO *PDRIVER_STARTIO;
```

DriverStartIo 是一个回调函数，运行在 **DISPATCH_LEVEL** IRQL。若需要驱动对 IRP 进行顺序处理，必须实现该函数，并与 I/O 管理器的设备队列配合。

串行化基本流程：

* 使用 IoStartPacket / IoStartNextPacket
* StartIo 例程

1. 在 DriverEntry 中设置 DriverObject->DriverStartIo = MyStartIo。

2. 在分发函数中调用 IoStartPacket，将 IRP 插入设备队列或直接执行。

3. I/O 管理器确保同一设备对象上，只有一个 IRP 在 StartIo 中执行。

4. StartIo 完成当前 IRP 后，调用 IoStartNextPacket 触发下一个 IRP 的执行。

StartIo 最小化实现：

```c
// 1. 在 DriverEntry 中设置 StartIo 回调
DriverObject->DriverStartIo = MyStartIo;

// 2. 实现 StartIo 回调
VOID MyStartIo(PDEVICE_OBJECT DeviceObject, PIRP Irp) {
    // 从 IRP 中获取读写参数
    // 执行硬件操作（如向设备端口写数据）
    // 完成 IRP，并告知 I/O 管理器处理队列中的下一个 IRP
    Irp->IoStatus.Status = STATUS_SUCCESS;
    IoCompleteRequest(Irp, IO_NO_INCREMENT);
}

// 3. 分发函数中需要调用 IoStartPacket 将 IRP 入队
NTSTATUS MyDispatchRead(PDEVICE_OBJECT DeviceObject, PIRP Irp) {
    IoStartPacket(DeviceObject, Irp, 0, NULL);
    return STATUS_PENDING;
}
```

::: tip 串行化并非只有 StartIo
队列也可以实现这种串行化操作，读者有兴趣可以自行了解
:::

### FastIoDispatch

FastIo 是一个非常容易混淆的概念，他与 IRP 相似但不同，如果说 FastIo 是**快速路径**，那么 IRP 就是**慢速路径**。

FastIoDispatch 的类型定义如下：

```c
typedef struct _FAST_IO_DISPATCH {
    ULONG SizeOfFastIoDispatch;
    PFAST_IO_CHECK_IF_POSSIBLE FastIoCheckIfPossible;
    PFAST_IO_READ FastIoRead;
    PFAST_IO_WRITE FastIoWrite;
    PFAST_IO_QUERY_BASIC_INFO FastIoQueryBasicInfo;
    PFAST_IO_QUERY_STANDARD_INFO FastIoQueryStandardInfo;
    PFAST_IO_LOCK FastIoLock;
    PFAST_IO_UNLOCK_SINGLE FastIoUnlockSingle;
    PFAST_IO_UNLOCK_ALL FastIoUnlockAll;
    PFAST_IO_UNLOCK_ALL_BY_KEY FastIoUnlockAllByKey;
    PFAST_IO_DEVICE_CONTROL FastIoDeviceControl;
    PFAST_IO_ACQUIRE_FILE AcquireFileForNtCreateSection;
    PFAST_IO_RELEASE_FILE ReleaseFileForNtCreateSection;
    PFAST_IO_DETACH_DEVICE FastIoDetachDevice;
    PFAST_IO_QUERY_NETWORK_OPEN_INFO FastIoQueryNetworkOpenInfo;
    PFAST_IO_ACQUIRE_FOR_MOD_WRITE AcquireForModWrite;
    PFAST_IO_MDL_READ MdlRead;
    PFAST_IO_MDL_READ_COMPLETE MdlReadComplete;
    PFAST_IO_PREPARE_MDL_WRITE PrepareMdlWrite;
    PFAST_IO_MDL_WRITE_COMPLETE MdlWriteComplete;
    PFAST_IO_READ_COMPRESSED FastIoReadCompressed;
    PFAST_IO_WRITE_COMPRESSED FastIoWriteCompressed;
    PFAST_IO_MDL_READ_COMPLETE_COMPRESSED MdlReadCompleteCompressed;
    PFAST_IO_MDL_WRITE_COMPLETE_COMPRESSED MdlWriteCompleteCompressed;
    PFAST_IO_QUERY_OPEN FastIoQueryOpen;
    PFAST_IO_RELEASE_FOR_MOD_WRITE ReleaseForModWrite;
    PFAST_IO_ACQUIRE_FOR_CCFLUSH AcquireForCcFlush;
    PFAST_IO_RELEASE_FOR_CCFLUSH ReleaseForCcFlush;
} FAST_IO_DISPATCH, *PFAST_IO_DISPATCH;
```

可以看到 FastIo 处理函数与 IRP 类似。**用户层无法直接调用** `FastIoDispatch`，这是系统专门为内核文件系统和过滤驱动提供的一条**快速通道**。

一旦为你的驱动设置 `FastIoDispatch` 回调，I/O 管理器会在合适的时机，自动尝试这条**快速路径**，以提升性能。`FastIoDispatch` 调用并非无条件，需要遵守一些规则。

触发机制：

1. **请求类型检查**：首先检查这个请求是否可能走快速路径。必须满足以下几个条件：
    文件句柄是同步打开的（没有指定 `FILE_FLAG_OVERLAPPED`）。
    操作的是缓存文件（没有指定 `FILE_FLAG_NO_BUFFERING`）。
    请求长度小于某个阈值（通常是64KB，**这段描述来自于 rectos代码 [第304行](https://doxygen.reactos.org/dd/dea/ntoskrnl_2fsrtl_2fastio_8c.html)，未在nt内核上验证**）。
2. **检查 FastIoDispatch 是否设置**
3. **调用快速路径**

## DeviceObject

一个驱动可以管理多个设备，驱动和设备是**一对多关系**。

结构体定义如下：

```c
typedef struct DECLSPEC_ALIGN(MEMORY_ALLOCATION_ALIGNMENT) _DEVICE_OBJECT {
    CSHORT Type;
    USHORT Size;
    LONG ReferenceCount;
    struct _DRIVER_OBJECT *DriverObject;
    struct _DEVICE_OBJECT *NextDevice;
    struct _DEVICE_OBJECT *AttachedDevice;
    struct _IRP *CurrentIrp;
    PIO_TIMER Timer;
    ULONG Flags;                                // See above:  DO_...
    ULONG Characteristics;                      // See ntioapi:  FILE_...
    __volatile PVPB Vpb;
    PVOID DeviceExtension;
    DEVICE_TYPE DeviceType;
    CCHAR StackSize;
    union {
        LIST_ENTRY ListEntry;
        WAIT_CONTEXT_BLOCK Wcb;
    } Queue;
    ULONG AlignmentRequirement;
    KDEVICE_QUEUE DeviceQueue;
    KDPC Dpc;

    //
    //  The following field is for exclusive use by the filesystem to keep
    //  track of the number of Fsp threads currently using the device
    //

    ULONG ActiveThreadCount;
    PSECURITY_DESCRIPTOR SecurityDescriptor;
    KEVENT DeviceLock;

    USHORT SectorSize;
    USHORT Spare1;

    struct _DEVOBJ_EXTENSION  *DeviceObjectExtension;
    PVOID  Reserved;

} DEVICE_OBJECT;

typedef struct _DEVICE_OBJECT *PDEVICE_OBJECT; 
```

|成员|作用|使用场景|
|-|-----|-----|
|Type|对象类型标识，`DEVICE_OBJECT` 的固定类型值||
|Size|结构体大小，包含设备扩展|创建时自动设置|
|ReferenceCount|设备对象的引用计数，控制生命周期|调试时查看，一般不直接修改|
|DriverObject|指向拥有此设备的驱动对象|在派遣函数中获取驱动信息|
|NextDevice|指向驱动创建的**下一个设备对象**，形成链表|遍历驱动的所有设备|
|AttachedDevice|指向**附加到此设备**上层的设备（过滤驱动）|遍历设备栈上层|
|CurrentIrp|当前正在处理的 IRP（用于串行化 I/O）|使用 `StartIo` 时由系统管理|
|Timer|关联的定时器对象|`IoInitializeTimer` 创建|
|Timer|设备特性标志，如 `DO_BUFFERED_IO`、`DO_DIRECT_IO`|**重要**，影响 I/O 操作方式|
|Characteristics|设备特征，如 `FILE_REMOVABLE_MEDIA`、`FILE_READ_ONLY_DEVICE`|告诉系统设备的特殊属性|
|Vpb|指向卷参数块（用于文件系统）|文件系统驱动使用|
|DeviceExtension|**设备扩展指针**，驱动私有数据区|**非常重要**，一些自定义内容可以存放到这里，存储设备状态、寄存器地址等|
|StackSize|设备栈的深度，IRP 需要多少栈空间|附加设备时可能需要调整|
|Queue|用于 `StartIo` 的队列管理||
|AlignmentRequirement|数据缓冲区的对齐要求|如 DMA 对齐要求|
|DeviceQueue|设备请求队列|`StartIo` 机制使用|
|Dpc|延迟过程调用对象，用于中断处理||
|ActiveThreadCount|活跃线程计数（文件系统专用）||
|SecurityDescriptor|安全描述符，控制访问权限||
|DeviceLock|设备锁事件，用于同步|同步使用|
|SectorSize|扇区大小（文件系统/磁盘驱动）|磁盘类驱动|
|DeviceObjectExtension|设备对象扩展（系统内部使用）||
|Reserved|保留字段||

### DO_DEVICE_INITIALIZING

`DO_DEVICE_INITIALIZING` 标志用于确保在设备对象完全初始化之前，**其他组件无法**向设备发送 I/O 请求。

当设备完成初始化后，必须手动清除 `DO_DEVICE_INITIALIZING`。如果忘记清除，设备将永远无法接受I/O请求。**Pnp 设备**同样也需要清除。

设备正确初始化：

```c
NTSTATUS MyAddDevice(PDRIVER_OBJECT DriverObject, PDEVICE_OBJECT PhysicalDeviceObject)
{
    PDEVICE_OBJECT deviceObject = NULL;
    NTSTATUS status;
    
    // 1. 创建设备对象（此时 DO_DEVICE_INITIALIZING 被 I/O 管理器自动设置）
    status = IoCreateDevice(DriverObject,
                            sizeof(DEVICE_EXTENSION),
                            NULL,
                            FILE_DEVICE_UNKNOWN,
                            0,
                            FALSE,
                            &deviceObject);
    if (!NT_SUCCESS(status)) {
        return status;
    }
    
    // 2. 初始化设备扩展
    PDEVICE_EXTENSION extension = (PDEVICE_EXTENSION)deviceObject->DeviceExtension;
    extension->DeviceObject = deviceObject;
    // ... 其他初始化
    
    // 3. 附加到设备栈（如果需要）
    PDEVICE_OBJECT attachedDevice = IoAttachDeviceToDeviceStack(deviceObject, PhysicalDeviceObject);
    
    // 4. 设置设备标志
    deviceObject->Flags |= DO_BUFFERED_IO;
    // ... 其他标志设置
    
    // 5. ⚠️ 关键：必须清除 DO_DEVICE_INITIALIZING
    deviceObject->Flags &= ~DO_DEVICE_INITIALIZING;
    
    return STATUS_SUCCESS;
}
```

### 缓冲IO和直接IO

* 缓冲IO： 当应用向设备发起I/O请求后，I/O管理器会将用户层数据复制到内核缓冲区；当内核返回数据时，I/O管理器从内核缓冲区将数据复制到用户层。
* 直接IO：驱动直接操作用户缓冲区。

```c
// 在创建设备时设置
deviceObject->Flags |= DO_BUFFERED_IO;  // 所有读写请求使用缓冲 I/O
// 或
deviceObject->Flags |= DO_DIRECT_IO;    // 所有读写请求使用直接 I/O
```

* 对于 IRP_MJ_DEVICE_CONTROL

**不受 DO_BUFFERED_IO 影响**，完全由 CTL_CODE 中的 Method 决定：

```c
// 这些方法不受设备 Flags 影响
#define METHOD_BUFFERED    0  // I/O 管理器创建系统缓冲区
#define METHOD_IN_DIRECT   1  // 输入用缓冲区，输出用 MDL
#define METHOD_OUT_DIRECT  2  // 输入用缓冲区，输出用 MDL
#define METHOD_NEITHER     3  // 直接传递用户地址
```

## 控制驱动

控制驱动（也叫软件驱动或者非Pnp驱动）主要用于内核软件，与Pnp驱动（硬件驱动）相对应。如内核Ark驱动，杀毒软件驱动都属于控制驱动。

### IO_STACK_LOCATION

`IO_STACK_LOCATION` 存放着属于当前设备栈的通信参数，示例代码如下：

```c
PIRP myIrp = ...;
PIO_STACK_LOCATION myIsl = IoGetCurrentIrpStackLocation(myIrp);
ULONG code = myIsl->Parameters.DeviceIoControl.IoControlCode;
```

### 控制驱动完整代码

```c
#include <wdm.h>


typedef struct _MY_DEVICE_DATA {
    ULONG SomeData;
} MY_DEVICE_DATA, * PMY_DEVICE_DATA;

#define DEVICE_NAME     L"\\Device\\TestDevice"
#define SYM_NAME        L"\\??\\TestDevice"

#define TestCtlCode CTL_CODE(FILE_DEVICE_UNKNOWN, 0x800, METHOD_BUFFERED, FILE_ANY_ACCESS)
#define HelloCtlCode CTL_CODE(FILE_DEVICE_UNKNOWN, 0x801, METHOD_BUFFERED, FILE_ANY_ACCESS)


VOID DriverUnload(PDRIVER_OBJECT DrvObj) {
    UNREFERENCED_PARAMETER(DrvObj);

    // 删除符号链接和设备
    UNICODE_STRING usSymLinkName = RTL_CONSTANT_STRING(SYM_NAME);
    IoDeleteSymbolicLink(&usSymLinkName);

    // 删除设备对象
    if (DrvObj->DeviceObject) {
        IoDeleteDevice(DrvObj->DeviceObject);
    }

    KdPrint(("Driver Unload!\n"));
}

NTSTATUS
MyDeviceControl(
    _In_ struct _DEVICE_OBJECT* DeviceObject,
    _Inout_ struct _IRP* Irp
) {
    NTSTATUS status = STATUS_SUCCESS;
    PIO_STACK_LOCATION irpStack = IoGetCurrentIrpStackLocation(Irp);
    ULONG ioControlCode = irpStack->Parameters.DeviceIoControl.IoControlCode;
    PVOID inputBuffer = Irp->AssociatedIrp.SystemBuffer;
    PVOID outputBuffer = Irp->AssociatedIrp.SystemBuffer;
    ULONG inputBufferLength = irpStack->Parameters.DeviceIoControl.InputBufferLength;
    ULONG outputBufferLength = irpStack->Parameters.DeviceIoControl.OutputBufferLength;
    ULONG bytesReturned = 0;

    // 获取设备扩展数据
    PMY_DEVICE_DATA deviceData = (PMY_DEVICE_DATA)DeviceObject->DeviceExtension;

    KdPrint(("MyDeviceControl called, IOCTL: 0x%X\n", ioControlCode));

    switch (ioControlCode) {
    case TestCtlCode:  // 自定义IOCTL示例
        if (inputBuffer != NULL && inputBufferLength >= sizeof(ULONG)) {
            // 读取输入数据
            deviceData->SomeData = *(PULONG)inputBuffer;
            KdPrint(("Received data: 0x%X\n", deviceData->SomeData));
            bytesReturned = 0;
            status = STATUS_SUCCESS;
        }
        else {
            status = STATUS_INVALID_PARAMETER;
        }
        break;

    case HelloCtlCode:  // 读取数据示例
        if (outputBuffer != NULL && outputBufferLength >= sizeof(ULONG)) {
            *(PULONG)outputBuffer = deviceData->SomeData;
            bytesReturned = sizeof(ULONG);
            status = STATUS_SUCCESS;
        }
        else {
            status = STATUS_BUFFER_TOO_SMALL;
        }
        break;

    default:
        status = STATUS_INVALID_DEVICE_REQUEST;
        break;
    }

    Irp->IoStatus.Status = status;
    Irp->IoStatus.Information = bytesReturned;
    IoCompleteRequest(Irp, IO_NO_INCREMENT);

    return status;
}

NTSTATUS
MyCreateClose(
    _In_ struct _DEVICE_OBJECT* DeviceObject,
    _Inout_ struct _IRP* Irp
) {
    UNREFERENCED_PARAMETER(DeviceObject);

    Irp->IoStatus.Status = STATUS_SUCCESS;
    Irp->IoStatus.Information = 0;
    IoCompleteRequest(Irp, IO_NO_INCREMENT);

    return STATUS_SUCCESS;
}

NTSTATUS DriverEntry(PDRIVER_OBJECT DrvObj, PUNICODE_STRING RegistryPath) {
    UNREFERENCED_PARAMETER(RegistryPath);

    NTSTATUS status = STATUS_SUCCESS;
    UNICODE_STRING usDeviceName = RTL_CONSTANT_STRING(DEVICE_NAME);
    UNICODE_STRING usSymLinkName = RTL_CONSTANT_STRING(SYM_NAME);
    PDEVICE_OBJECT DevObj = NULL;
    PMY_DEVICE_DATA deviceData = NULL;

    KdPrint(("DriverEntry: Starting driver initialization...\n"));

    // 设置卸载函数
    DrvObj->DriverUnload = DriverUnload;

    // 设置IRP处理函数
    DrvObj->MajorFunction[IRP_MJ_CREATE] = MyCreateClose;
    DrvObj->MajorFunction[IRP_MJ_CLOSE] = MyCreateClose;
    DrvObj->MajorFunction[IRP_MJ_DEVICE_CONTROL] = MyDeviceControl;

    // 创建设备对象
    status = IoCreateDevice(DrvObj,
        sizeof(MY_DEVICE_DATA),
        &usDeviceName,
        FILE_DEVICE_UNKNOWN,
        FILE_DEVICE_SECURE_OPEN,
        FALSE,
        &DevObj);

    if (!NT_SUCCESS(status)) {
        KdPrint(("Device create failed! Status: 0x%X\n", status));
        return status;
    }

    KdPrint(("Device created successfully\n"));
    KdPrint(("Device flags before clearing: 0x%X\n", DevObj->Flags));

    // 初始化设备扩展数据
    deviceData = (PMY_DEVICE_DATA)DevObj->DeviceExtension;
    deviceData->SomeData = 0xabcd;

    // 设置设备缓冲区方式
    DevObj->Flags |= DO_BUFFERED_IO;

    // 重要：清除DO_DEVICE_INITIALIZING标志
    DevObj->Flags &= ~DO_DEVICE_INITIALIZING;

    KdPrint(("Device flags after clearing DO_DEVICE_INITIALIZING: 0x%X\n", DevObj->Flags));

    // 创建符号链接
    status = IoCreateSymbolicLink(&usSymLinkName, &usDeviceName);
    if (!NT_SUCCESS(status)) {
        KdPrint(("Symbolic link creation failed! Status: 0x%X\n", status));
        // 注意：这里不需要重新设置DO_DEVICE_INITIALIZING标志
        // 直接删除设备即可
        IoDeleteDevice(DevObj);
        return status;
    }

    KdPrint(("Symbolic link created successfully\n"));
    KdPrint(("DriverEntry: Driver loaded successfully!\n"));
    KdPrint(("Device Name: %wZ\n", &usDeviceName));
    KdPrint(("Symbolic Link: %wZ\n", &usSymLinkName));
    KdPrint(("Device Object: 0x%p\n", DevObj));

    return STATUS_SUCCESS;
}
```

---

::: tip 版权声明
本文版权归 [lee0xb1t](https://github.com/lee0xb1t) 所有，未经许可不得以任何形式转载。
:::
