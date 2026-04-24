---
icon: lucide:network
date: 2026-04-20
updated: 2026-04-20
tags:
  - network
  - protocol
  - filter
  - windows
  - driver
---

# WFP 过滤驱动01：基础

Windows 筛选平台（Windows Filtering Platform）是一套系统服务和 API，为软件提供了深入检查、修改和监控网络流量的能力。

## WFP 架构

WFP 架构是分层的，跨越了**用户态和内核态（框架为用户态和内核态提供了相关api）**。通过为不同层级安插**钩子（Hook）**，让软件能够深度介入网络流程。

<!-- markdownlint-disable MD033 -->
<style lang="sass">
  #flowchart-section1 .mermaid-content svg
    width: 70% !important
    height: auto !important
</style>

<div id="flowchart-section1">

```mermaid
flowchart TD
  A[应用程序<br>（如防火墙、杀毒软件）] --> B[用户模式<br>（User Mode）]

  subgraph B [用户模式]
      B1[基础筛选引擎<br>（BFE 服务）] --> B2[用户态筛选引擎<br>（~10个筛选层）]
  end

  B2 <--> C[内核模式<br>（Kernel Mode）]

  subgraph C [内核模式]
      C1[内核态筛选引擎<br>（~50个筛选层）] --> C2[垫片<br>（ALE, TLM, NLM, etc.）]
      C1 --> C3[标注<br>（Callout 驱动程序）]
  end

  C2 <--> D[TCP/IP 网络协议栈]
  D <--> E[网络]
```

</div>

### 基础筛选引擎 (BFE)

基础筛选引擎位于用户态，运行在 svchost.exe 中的服务（bfe.dll），负责接收来自软件的规则、执行安全内置模型（如权限验证），并将规则下发至筛选引擎。

### 垫片 (Shims)

垫片(Shims)位于内核态，由WFP筛选引擎实现。作为 WFP 筛选引擎在协议栈各层安插的内核模块，负责解析原始数据包，将其属性（如 IP、端口）暴露给筛选引擎，并执行引擎返回的裁决结果（如阻止、准许）。

### 标注 (Callouts)

标注(Callouts)位于内核态，由第三方驱动程序提供的回调函数。当筛选引擎匹配到特定规则时，可触发对应标注，以执行深度内容检查（如病毒扫描）、数据修改等复杂操作。

## WFP 触发层级

WFP 已经抽象出了每个层级

### 时序图

<style lang="sass">
  #flowchart-section2 .mermaid-content svg
    width: 95% !important
    height: auto !important
</style>

<div id="flowchart-section2">

```mermaid
sequenceDiagram
    participant App as 应用程序
    participant WFP as WFP 筛选框架
    participant NDIS as NDIS 驱动层
    participant NIC as 网卡驱动

    Note over WFP: 数据进入WFP后，按层级从上到下触发

    App->>WFP: 发送/接收数据请求

    rect rgb(230, 245, 255)
        Note over WFP: ALE_AUTH（授权阶段）
        WFP-->>WFP: ALE_AUTH_LISTEN_V4/V6
        WFP-->>WFP: ALE_AUTH_RECV_ACCEPT_V4/V6
        WFP-->>WFP: ALE_AUTH_CONNECT_V4/V6
        Note right of WFP: 连接未建立，未发包<br>可获取：PID、路径、IP、端口、协议<br>用途：应用级防火墙、控制程序联网
    end

    rect rgb(255, 245, 230)
        Note over WFP: ALE_FLOW_ESTABLISHED
        WFP-->>WFP: ALE_FLOW_ESTABLISHED_V4/V6
        Note right of WFP: 连接已建立，Flow已创建<br>用途：连接统计、限速、状态监控
    end

    alt TCP 协议
        rect rgb(230, 255, 230)
            Note over WFP: STREAM层（TCP专用）
            WFP-->>WFP: STREAM_V4/V6<br>STREAM_PACKET_V4/V6
            Note right of WFP: 数据已TCP重组<br>用途：深度包检测、HTTP/SQL注入检测<br>敏感词过滤、数据审计
        end
    else UDP 协议
        rect rgb(255, 240, 230)
            Note over WFP: DATAGRAM层（UDP专用）
            WFP-->>WFP: DATAGRAM_DATA_V4/V6
            Note right of WFP: 用途：DNS过滤、UDP防火墙<br>游戏封包分析
        end
    end

    rect rgb(250, 240, 255)
        Note over WFP: TRANSPORT层（传输层）
        WFP-->>WFP: INBOUND/OUTBOUND_TRANSPORT_V4/V6
        WFP-->>WFP: IPSEC_TRANSPORT / TRANSPORT_FAST
        Note right of WFP: TCP/UDP包已生成，可能分片<br>不推荐此层解析Payload<br>用途：端口过滤、DDoS防御
    end

    rect rgb(255, 235, 235)
        Note over WFP: IPPACKET层（最底层）
        WFP-->>WFP: INBOUND/OUTBOUND_IPPACKET_V4/V6
        Note right of WFP: 仅IP头，无进程/端口信息<br>用途：VPN、NAT、IP伪造检测
    end

    WFP->>NDIS: 通过筛选的数据包
    Note over NDIS: 统一网卡驱动接口<br>隔离协议栈与硬件
    NDIS->>NIC: 数据包下发
    Note over NIC: Miniport Driver
```

</div>

### 流程图

<style lang="sass">
  #flowchart-section3 .mermaid-content svg
    width: 55% !important
    height: auto !important
</style>

<div id="flowchart-section3">

```mermaid
flowchart TD
    A[网络数据包] --> B{WFP 筛选引擎}
    
    B --> C["ALE_AUTH<br>授权检查<br>获取PID/路径/IP/端口<br>连接未建立"]
    C -->|阻止| D[丢弃 DISCARD]
    C -->|允许| E["ALE_FLOW_ESTABLISHED<br>连接已建立，Flow创建"]
    
    E --> F{协议类型}
    
    F -->|TCP| G["STREAM层<br>数据已重组<br>DPI/内容检测/审计"]
    F -->|UDP| H["DATAGRAM层<br>UDP数据报<br>DNS过滤/游戏分析"]
    
    G --> I["TRANSPORT层<br>传输层包处理<br>端口过滤/DDoS防御"]
    H --> I
    
    I --> J["IPPACKET层<br>IP包直接处理<br>VPN/NAT/IP伪造检测"]
    
    J --> K[NDIS驱动层]
    K --> L[网卡驱动 Miniport]
    
    D --> M[阻止日志/通知]
```

</div>

::: note 还有许多其他的层级，有兴趣可以自行了解
FWPM_LAYER_INGRESS_VSWITCH_TRANSPORT_V4：进入虚拟交换机的 IPv4 transport packet
FWPM_LAYER_INGRESS_VSWITCH_TRANSPORT_V6：与 V4 相同
FWPM_LAYER_EGRESS_VSWITCH_TRANSPORT_V4：离开虚拟交换机的 IPv4 transport packet
FWPM_LAYER_EGRESS_VSWITCH_TRANSPORT_V6：与 V4 相同
FWPM_LAYER_INBOUND_TRANSPORT_FAST：高速 inbound packet path
FWPM_LAYER_OUTBOUND_TRANSPORT_FAST：高速 outbound path
FWPM_CALLOUT_IPSEC_INBOUND_TRANSPORT_V4：IPSec inbound transport packet
FWPM_CALLOUT_IPSEC_INBOUND_TRANSPORT_V6：与 V4 相同
FWPM_CALLOUT_IPSEC_OUTBOUND_TRANSPORT_V4：IPSec outbound encrypt
FWPM_CALLOUT_IPSEC_OUTBOUND_TRANSPORT_V6：与 V4 相同
FWPM_CALLOUT_WFP_TRANSPORT_LAYER_V4_SILENT_DROP：静默丢弃 IPv4 transport packet
FWPM_CALLOUT_WFP_TRANSPORT_LAYER_V6_SILENT_DROP：与 V4 相同
:::

## FlowContext

`FlowContext`由驱动代码显式创建，一般在**ALE_FLOW_ESTABLISHED**层通过`FwpsFlowAssociateContext`关联到自定义类型。**ALE**各层可以获取进程ID等信息，供后层使用。

`FlowContext`必须通过`flowDeleteFn`回调函数删除，避免内存泄漏。

::: warning 经过实验FlowContext只能在`STREAM层`和`DATAGRAM层`使用
`Transport层`和`IPPACK层`无法使用
:::

## 流量转发

### TCP 流量转发

TCP 流量转发比较好的方案是转发连接，在`FWPM_LAYER_ALE_AUTH_CONNECT_V4/V6`层实现，代码可以参考[lee0xb1t/leaf](https://github.com/lee0xb1t/leaf)。

### UDP 流量转发

UDP 流量转发微软官方demo通过在`FWPM_LAYER_DATAGRAM_DATA_V4/V6`层修改 UDP 数据包目标地址实现，代码可以参考[ddproxy](https://github.com/microsoft/windows-driver-samples/tree/main/network/trans/ddproxy)。
