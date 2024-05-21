1. eBPF 技术简介（怎么用 eBPF 技术获取信息（kprobe），存储信息，用 eBPF 的优势）
2. gdbserver 协议, gdbserver 和 eBPF server 的不同（eBPF-server 以异步的消息为主。异步的消息和同步的
   消息重合了怎么办（%））
3. 用 gdb 的 python 扩展（重新编译）
4. py 脚本的编写（另一个线程）
5. qemu 支持新串口（为什么要用第二个串口，pmp，基于中断的串口消息收发机制（正是因为这个机制，消息不
   能返回 server，而是直接由 eBPF 程序返回），qemu virtio）

没写的内容： ebpf 实现：移植，升级，对 eBPF 以外的符号信息的依赖；

eBPF lambda 图 helpers
