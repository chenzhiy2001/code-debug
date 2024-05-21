# VScode 同时连接被跟踪操作系统的 OpenOCD 和 eBPF 的实施方案

我们跟踪的目标（target）是同一个，但是通过两种跟踪技术同时跟踪。我们把会改变操作系统状态的那个跟踪技
术（Qemu 的 gdbserver 或 OpenOCD）称为 main-stub，eBPF 的 GDBServer 称为 side-stub。 Main-stub 负责
控制，而 side-stub 只负责收集信息，不能影响内核的状态。

在使用流程上，二者的区别在于，ebpf server 要提前指定要做的事。具体如下：

main-sub 的流程：

1. 设置断点
1. **断点触发，os 暂停运行**
1. GDB 等待用户输入命令，根据用户的命令执行信息收集，改变 os 状态等行为

side-stub 的流程：

1. 设置断点，**提前指定断点触发后的操作**。
1. os 注册相关的 ebpf 程序
1. 断点触发，eBPF 程序执行这些操作，返回信息，os 继续运行。

二者是可以同时存在的。在具体实现方面，最方便的方式是利用 python 脚本注册新的 gdb 命令（我打算直接叫
它`side-stub`）。这样的好处有两个，一是不需要改动 gdb 的源代码，二是 VSCode 端不需要做大幅度的调整，
现有的断点组切换等功能无需改动，只要支持一个新的 gdb 命令即可。

对于这个新的 gdb 命令的初步构想：

```
// 连接到ebpf server的串口.
// python脚本负责向串口发送信息.
// python脚本接收到的信息会返回给gdb.
side-stub target remote /dev/tty1
```

```
// 在某地址设置断点，然后收集寄存器信息
side-stub break 0x8020xxxx then-get register-info
```

```
// 收集函数参数
side-stub arguments <function-name>
```

此外还要琢磨一个事，编译的时候，符号信息应该单独提取出来，提供给 gdb，由 gdb 做符号解析，看看能否做
到不用修改内核编译参数。

控制相关的功能有：

- 断点
- 单步
- 设置寄存器
- 设置内存

监测相关的功能有：

- 符号转地址（这个虽然可以在 ebpf 中做，但也可以在 gdb 上做）
- 查看寄存器
- 查看内存
