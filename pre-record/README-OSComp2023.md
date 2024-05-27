# 赛题
支持Rust语言的源代码级操作系统调试工具：[proj158-rust-debugger](https://github.com/oscomp/proj158-rust-debugger)

## 主要工作
- 支持 Rust 操作系统的基于 GDB 的内核态，用户态代码联合断点调试
- 解决 Rust 操作系统中基于 eBPF 的内核态，用户态代码的动态跟踪调试
- 远程开发环境下的用户界面（集成开发环境）支持与qemu，实际硬件（部分完成）的支持

## 项目整体框架
![](./docs/imgs/框架.png)
## 文档和演示

- 展示文档
	- 2023.08.15 [决赛项目文档](./最终报告.pdf)
	- 2023.08.16 [决赛演示视频](./演示视频.mp4)
	- 2023.03.25 [OSATC会议分享PPT](./docs/陈志扬-OSATC-20230325-1807.pdf)
	- 2023.06.17 [2023年操作系统比赛第13场报告会 PPT](./docs/2023-oscomp-share-13.pdf)

- 开发过程中积累的文档

| 文档链接                                                     | 文档内容 |
| ------------------------------------------------------------ | -------- |
| [port-to-hardware.md](./docs/port-to-hardware.md)            | 支持硬件调试的思路                                                             |
| [arch-eBPF-thoughts.md](./docs/arch-eBPF-thoughts.md)        |  动态调试方案的构思                                       |
| [Github Readme](./README-Github.md)                          | 本项目的Github主页。包含了对本项目的简单介绍、详细的安装指南、常用API使用方法介绍 |
| [rCore-Tutorial-Code-2023S 移植文档](./docs/2023S.md)       | 将调试器适配到rCore-Tutorial-Code-2023S的指南            |
| [2023-07-07-修正文档.pdf](./docs/2023-07-07-修正文档.pdf)    | 对调试器参数的调整         |
| [rCore学习文档](./docs/rcore学习文档.md)                     | 团队成员对rCore-Tutorial-v3代码的讨论                        |
| [调试器测试文档](./docs/调试器测试文档.md)                   | 团队成员将早期版本的调试器配置到新虚拟机里的过程             |
| [进程名字的支持](./docs/pcb_name.md)                         | 给PCB中添加进程名的探索过程                                  |
| [2023-01-02-rcore-Tutorial-ebpf复现文档.md](./docs/2023-01-02-rcore-Tutorial-ebpf复现文档.md) | 移植kprobe, eBPF过程中遇到的编译问题          |
| [Slides-August.md](./docs/Slides-August.md)                  | PPT草稿（2022）                                                             |
| [Slides-August.pdf](./docs/Slides-August.pdf)                | PPT草稿（2022）                                                            |
| [Slides-July.pdf](./docs/Slides-July.pdf)                    | PPT草稿（2022）                                                       |
| [Slides-OSATC.md](./docs/Slides-OSATC.md)                    | PPT草稿（2023 OSATC）                                                |
| [diff-rCore-Tutorial-Code-2023S-kernel.diff](./docs/diff-rCore-Tutorial-Code-2023S-kernel.diff) | 让rCore-Tutorial-Code-2023S适配调试器所需要的内核修改                                |
| [diff-rCore-Tutorial-Code-2023S-user.diff](./docs/diff-rCore-Tutorial-Code-2023S-user.diff) | 让rCore-Tutorial-Code-2023S适配调试器所需要的用户程序编译流程的修改                                   |
| [ebpf vs ptrace.md](./docs/ebpf_vs_ptrace.md)                | eBPF和ptrace对比                                                             |
| [ebpf-ui.md](./docs/ebpf-ui.md)                              |  调试界面需求文档                                                            |
| [ebpf-update.md](./docs/ebpf-update.md)                      |  移植kprobe,ebpf模块时遇到的问题                                                            |
| [memory-read-write.md](./docs/memory-read-write.md)          |  HexEditor的实现                                                            |
| [mid.md](./docs/mid.md)                                      |  中期检查文档                                                     |
| [multiple_stubs.md](./docs/multiple_stubs.md)                |  一个GDB连两个gdbserver的实施方案                                                            |
| [new-code-debug-8-3.drawio](./docs/new-code-debug-8-3.drawio) |  本项目的框架图（需要用draw.io打开）                                       |
| [oscomp-final.pptx](./docs/oscomp-final.pptx)                |   2022年OS比赛答辩PPT                                                           |
| [port.md](./docs/port.md)                                    |  将调试器适配到其他OS的方法（早期版本）                                               |
| [rCore-mod-old.diff](./docs/rCore-mod-old.diff)              |  为了适配调试器，rCore-Tutorial-v3需要做出的修改（早期版本）                                                            |
| [rCore-mod-older.md](./docs/rCore-mod-older.md)              |  为了适配调试器，rCore-Tutorial-v3需要做出的修改（早期版本）                                                              |
| [rCore-mod.diff](./docs/rCore-mod.diff)                      |  为了适配调试器，rCore-Tutorial-v3需要做出的修改（早期版本）                                                              |
| [thesis-2023-july.md](./docs/thesis-2023-july.md)            |  文档提纲                                                            |
| [thesis-outline.md](./docs/thesis-outline.md)                |  文档提纲                                                            |
| [thesis.md](./docs/thesis.md)                                |  文档草稿                                                            |
| [treeview.md](./docs/treeview.md)                            |  用新API实现VSCode界面                                                 |

- 开发日志

| 文档链接                                                     | 文档内容                                                     |
| ------------------------------------------------------------ | ------------------------------------------------------------ |
| [硬件开发文档](./docs/硬件开发文档.md)                       | 对硬件调试的尝试                                             |
| [开发记录和知识库.pdf](./docs/开发记录和知识库.pdf)          | 去年的开发记录                                               |
| [2023-02-13](./docs/2023-02-13.md)                           | 每周开发纪要                                                 |
| [2023-02-20](./docs/2023-02-20.md)                           | 每周开发纪要                                                 |
| [2023-03-02](./docs/2023-03-02.md)                           | 每周开发纪要                                                 |
| [2023-03-09](./docs/2023-03-09.md)                           | 每周开发纪要                                                 |
| [2023-03-16](./docs/2023-03-16.md)                           | 每周开发纪要                                                 |
| [2023-03-23](./docs/2023-03-23.md)                           | 每周开发纪要                                                 |
| [2023-03-30](./docs/2023-03-30.md)                           | 每周开发纪要                                                 |
| [2023-04-06](./docs/2023-04-06.md)                           | 每周开发纪要                                                 |
| [2023-04-13](./docs/2023-04-13.md)                           | 每周开发纪要                                                 |
| [2023-04-20](./docs/2023-04-20.md)                           | 每周开发纪要                                                 |
| [2023-04-27](./docs/2023-04-27.md)                           | 每周开发纪要                                                 |
| [2023-05-04](./docs/2023-05-04.md)                           | 每周开发纪要                                                 |
| [2023-05-11](./docs/2023-05-11.md)                           | 每周开发纪要                                                 |
| [2023-05-18](./docs/2023-05-18.md)                           | 每周开发纪要                                                 |
| [2023-05-25](./docs/2023-05-25.md)                           | 每周开发纪要                                                 |
| [2023-06-01](./docs/2023-06-01.md)                           | 每周开发纪要                                                 |
| [2023-06-08](./docs/2023-06-08.md)                           | 每周开发纪要                                                 |
| [2023-06-15](./docs/2023-06-15.md)                           | 每周开发纪要                                                 |
| [2023-06-23](./docs/2023-06-23.md)                           | 每周开发纪要                                                 |
| [2023-06-29](./docs/2023-06-29.md)                           | 每周开发纪要                                                 |
| [2023-07-05](./docs/2023-07-05.md)                           | 每周开发纪要                                                 |
| [2023-07-13](./docs/2023-07-13.md)                           | 每周开发纪要                                                 |
| [2023-07-20](./docs/2023-07-20.md)                           | 每周开发纪要                                                 |
| [2023-07-27](./docs/2023-07-27.md)                           | 每周开发纪要                                                 |
| [2023-01-02-rcore-Tutorial-ebpf复现文档.md](./docs/2023-01-02-rcore-Tutorial-ebpf复现文档.md) | 移植kprobe,eBPF时遇到的编译问题                              |
| [2023-07-07-修正文档.pdf](./docs/2023-07-07-修正文档.pdf)    | 调整调试器配置参数的过程                                     |
| [2023-07-09.md](./docs/2023-07-09.md)                        | 7月9日开发日志                                               |
| [2023-07-12.md](./docs/2023-07-12.md)                        | 7月12日开发日志                                              |
| [2023-07-15.md](./docs/2023-07-15.md)                        | 7月15日开发日志-解决一个闭包函数指针带来的编译错误           |
| [2023-07-16.md](./docs/2023-07-16.md)                        | 7月16日开发日志                                              |
| [2023-07-19.md](./docs/2023-07-19.md)                        | 7月19日开发日志-解决uprobe初始化过程中PCB借用问题            |
| [2023-07-23.md](./docs/2023-07-23.md)                        | 7月23日开发日志-uprobe模块通过编译，但还有bug                |
| [2023-07-24.md](./docs/2023-07-24.md)                        | 7月24日开发日志                                              |
| [2023-07-26.md](./docs/2023-07-26.md)                        | 7月26日开发日志-编写uprobe基础设施                           |
| [2023-07-27.md](./docs/2023-07-27.md)                        | 7月27日开发日志-解决uprobe模块内存访问bug                    |
| [2023-07-28.md](./docs/2023-07-28.md)                        | 7月28日开发日志-解决uprobe注册过程中的bug                    |
| [2023-07-29.md](./docs/2023-07-29.md)                        | 7月29日开发日志-解决uprobe依赖问题，编写uprobe handler，uprobe基本移植完毕。 |
| [2023-07-30.md](./docs/2023-07-30.md)                        | 7月30日开发日志-尝试在被调试的OS里跑iPerf从而测试网络性能    |
| [2023-07-31.md](./docs/2023-07-31.md)                        | 7月31日开发日志-尝试在被调试的OS里跑iPerf从而测试网络性能    |
| [2023-08-01.md](./docs/2023-08-01.md)                        | 8月1日开发日志-写uprobe移植指南，继续尝试跑iPerf             |
| [2023-08-02.md](./docs/2023-08-02.md)                        | 8月2日开发日志-尝试为 rCore-Tutorial-v3 编译iPerf            |
| [2023-08-04.md](./docs/2023-08-04.md)                        | 8月4日开发日志-转移工作重心                                  |
| [2023-08-06.md](./docs/2023-08-06.md)                        | 8月6日开发日志-尝试Debug rCore-Tutorial-v3自带的网络应用     |
| [2023-08-10.md](./docs/2023-08-10.md)                        | 8月10日开发日志                                              |
| [2023-08-14.md](./docs/2023-08-14.md)                        | 8月14日开发日志-解决uprobe模块最后一个bug。至此所有代码编写完毕。 |



## 项目进展

内核代码的调试难度大通常是阻碍开发人员进行操作系统功能开发的重要因素。由于操作系统内核代码复杂，静态分析、动态分析都具有相当的难度，包括特权级切换，进程调度，页表管理等。已有的集成开发环境通常面向应用程序的开发，对操作系统代码特别是新兴的Rust操作系统代码开发调试暂未提供良好的支持。如何提供方便、高效且可跨特权级跟踪的操作系统调试工具是待解决的关键问题。为了解决该问题，本工作将GDB与eBPF结合，通过远程访问的形式，提供方便的Qemu与实际硬件环境的Rust操作系统的开发与调试。实现用户态、内核态代码的静态断点调试与动态跟踪调试结合，提供了基于VSCode插件的用户交互界面。

我们主要解决以下三个关键问题：

(1) 支持基于GDB的内核态，用户态代码联合断点调试；

(2) 基于eBPF的内核态，用户态代码的动态跟踪调试；

(3) 远程开发环境下的用户界面（集成开发环境）支持与qemu，实际硬件（部分完成）的支持。

在去年的操作系统功能赛道中，本工作已经实现（1）中部分功能，即内核态与0号用户进程的联合断点调试，在今年的工作中，我们在上述基础上进一步实现了内核态与不同用户进程的联合断点调试，并完善了特权级切换功能，具体请见第二节内容。除此之外，（2）中的技术问题已基本实现，具体请见文档第三节内容，而（3）中关于实际硬件的支持由于时间关系只做了部分的尝试，目前只能完整支持基于Qemu的开发环境，具体请见文档第四节内容。此外，本工作基于已实现的调试器完成了一个HTTP网页应用的调试，并成功定位到一个疑难问题，具体请见文档第五节内容。


## 项目仓库

| 仓库名                    | 仓库描述                                                     | Github 地址                                                 | commit数量（2022年8月至今）                                  |
| ------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------- | ------------------------------------------------------------ |
| code-debug                | 本仓库                                                       | <https://github.com/chenzhiy2001/code-debug>                | 124                                                          |
| ruprobes                  | 我们移植的uprobe模块和详细的移植文档                         | <https://github.com/chenzhiy2001/ruprobes>                  | 5                                                            |
| rcore-ebpf(全小写)        | 整合了ebpf,kprobe,uprobe模块的rCore-Tutorial-v3              | <https://github.com/chenzhiy2001/rcore-ebpf>                | 8                                                            |
| uCore-Tutorial-Test-2022A | rcore-ebpf的C程序支持                                        | <https://github.com/chenzhiy2001/uCore-Tutorial-Test-2022A> | 2                                                            |
| trap_context_riscv        | trap_context crate （用于uprobe移植）                        | <https://github.com/chenzhiy2001/trap_context_riscv>        | 5                                                            |
| rCore-Tutorial-v3         | 修改版rCore-Tutorial-v3，主要包括多个实验分支的调试器部分功能适配，以及main分支的调试器全功能适配 | <https://github.com/chenzhiy2001/rCore-Tutorial-v3>         | 11（包括所有分支）                      |
| qemu-system-riscv64       | 修改版的Qemu虚拟机                                           | <https://github.com/chenzhiy2001/qemu-system-riscv64>       | 1(关于我们对Qemu做的修改，可以看[文档3.3.2节](./最终报告.pdf)) |
| rustsbi-qemu              | 修改版的RustSBI                                              | <https://github.com/chenzhiy2001/rustsbi-qemu>              | 1(关于我们对RustSBI做的修改，可以看[文档3.3.2节](./最终报告.pdf)) |
| code-debug-doc            | 旧文档仓库，记录了6月之前的工作                              | <https://github.com/chenzhiy2001/code-debug-doc>            | 13                                                           |

# 致谢

感谢团队成员（陈志扬，向驹韬）之间的相互鼓励和支持

感谢指导老师（吴竞邦老师，赵霞老师）不辞劳苦对本项目的引导