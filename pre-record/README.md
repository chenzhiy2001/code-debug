# proj158-rust-debugger

支持Rust语言的源代码级内核调试工具

- 2023.09.20 [2023年操作系统比赛第17场报告会PPT](./oscomp_share17_rust_debugger.pptx)
- 2023.08.20 [决赛PPT](./%E7%AD%94%E8%BE%A9PPT.pptx)
- 2023.08.15 [决赛项目文档](./最终报告.pdf)
- 2023.08.16 [决赛演示视频](./演示视频.mp4)

## 项目整体框架
![项目整体框架](./docs/imgs/framework.png)


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


## 引言

### 项目背景

方便的源代码级调试工具，对监测程序运行状态和理解程序的逻辑十分重要，尤其是相对复杂的内核代码以及用户态、内核态的系统调用交互；高效的Rust语言跟踪能力，是Rust操作系统内核开发的必要工具，对基于Rust的操作系统教学和实验很有帮助。然而现有RISC-V、Rust实验环境搭建成本高，上手难度大，不利于初学者的内核学习与开发工作。

### 项目目标

本项目拟实现一种基于VSCode以及云服务器的内核源代码远程调试工具：在云服务器中部署QEMU虚拟机并运行Rust操作系统，通过QEMU提供GDB接口与用户本地的网页或安装版VSCode进行连接，实现远程单步断点调试能力，提供一种对用户友好的Rust内核代码、用户态代码以及系统调用代码的调试方法。


### 相关工作

#### VS Code 中的调试架构

VS Code基于Debug Adapter 协议，实现了一个原生的，非语言相关的调试器UI，它可以和任意后台调试程序通信。通常来讲，gdb等调试器不会实现Debug Adapter 协议，因此需要调试适配器（Debug Adapter）去“适配”这个协议，它一般而言是一个独立和调试器通信的进程。

![](./docs/imgs/debug-arch1.png)


#### Debug Adapter 协议

该协议主要由以下三个部分组成：

##### Events

此部分定义了调试过程中可能发生的事件

##### Requests

此部分定义了VSCode等调试器UI对Debug Adapter的请求

##### Responds

此部分定义了Debug Adapter对请求的回应

#### gdbstub on qemu

QEMU 支持通过远程连接工具访问 QEMU 中的 gdbserver。 这允许以与在真实硬件上使用 JTAG 等低级调试工具相同的方式调试客户代码。 可以停止和启动虚拟机，检查寄存器和内存等状态，并设置断点和观察点。

## 调试工具设计

### 整体架构设计

如下图所示，本调试工具主要分为以下几个模块：

### TreeView

TreeView是VSCode已有的原生UI，可以进行数据展示，发送命令等功能，更多解释请看 [treeview.md](./docs/treeview.md)。

可以展示的信息：

| 名称       | 功能                                                         | 更新策略                                     |
| ---------- | ------------------------------------------------------------ | -------------------------------------------- |
| 寄存器信息 | 显示寄存器名及寄存器值                                       | 触发断点或暂停时更新                         |
| 内存信息   | 显示指定位置和长度的内存信息，可增删                         | 触发断点、暂停、用户修改请求的内存信息时更新 |
| 断点信息   | 显示当前设置的断点以及暂未设置的，缓存的其他内存空间下的断点（比如在内核态时某用户程序的断点） | 触发断点或暂停时更新                         |

用户界面有如下功能按钮，该按钮可以在package.json和src/frontend/extension.ts中进行注册：


| 名称                           | 功能                                                     |
| ------------------------------ | -------------------------------------------------------- |
| gotokernel                     | 在用户态设置内核态出入口断点，从用户态重新进入内核态     |
| setKernelInBreakpoints         | 设置用户态到内核态的边界处的断点                         |
| setKernelOutBreakpoints        | 设置内核态到用户态的边界处断点                           |
| removeAllCliBreakpoints        | 重置按钮。清空编辑器，Debug Adapter, GDB中所有断点信息   |
| disableCurrentSpaceBreakpoints | 令GDB清除当前设置的断点且不更改Debug Adapter中的断点信息 |
| updateAllSpacesBreakpointsInfo | 手动更新断点信息表格                                     |



### 插件进程

见见src/frontend/extension.ts。插件进程发送Requests(包括customRequest)给Debug Adapter并接收Debug Adapter发送的Response和Events

### Debug Adapter

本项目使用一个独立进程作为Debug Adapter。本项目主要增加了涉及操作系统调试的处理流程。
见src/mibase.ts

### 涉及操作系统调试的处理流程

#### 消息类型

根据Debug Adapter 协议。本项目主要使用以下三个传递信息的途径：

- Requests：各类消息请求的格式。本项目通过其中的CustomRequests扩展了一些操作系统调试相关的请求。
- Response：对于Requests的响应。
- Events：Debug Adapter事件。Events和Response都能向插件进程返回数据。

#### 当前特权级检测

RISC-V处理器没有寄存器可以透露当前的特权级，因此本项目在内核代码中，内核态进入用户态以及用户态返回内核态处各设置一个断点，断点被触发时更新特权级信息。
此外再辅以当前执行的代码的文件名，内存地址空间等手段判断当前的特权级。

#### 特权级变化时的处理

##### 切换断点

如果同时令GDB设置内核态和用户态代码的断点，会导致这些断点全部失效（推测是因为执行sfence.vma指令之后，TLB刷新成用户进程的页表，导致内核地址空间的断点无法被设置）。因此，rCore运行在内核态时GDB只能设置内核态的断点，用户态同理。本项目为了方便用户进行用户态程序的调试，跟踪系统调用，如果用户在内核态时设置了用户态的断点，这个断点的信息会被存储在Debug Adapter中，特权级发生变化时自动令GDB删除旧断点，并设置之前缓存下来的断点。
在Debug Adapter中，断点被分为很多组，根据不同情况可以切换不同组的断点。

##### 切换符号表

特权级切换时自动切换到对应的用户态程序的符号表文件。
具体见src/mibase.ts

### GDB/MI Interface

GDB/MI是GDB面向机器的、基于行的文本接口。它用于支持将调试器作为Debugger插件的一个小模块来使用的系统开发。本项目将用户请求（Debug Adapter Requests）转换为符合GDB/MI接口规范的文本并通过管道发送给GDB进程。GDB进程同样返回符合GDB/MI接口规范的文本数据。


### GDB和Qemu虚拟机

Qemu虚拟机运行rCore-Tutorial操作系统，本项目中Qemu开启了gdbstub功能，该功能开启一个gdbserver，本地的gdb通过tcp协议连接gdbserver




## 调试工具实现

TODO: 这一节所列出的代码有**少量**变动，应当更新

### 常用API、GDB命令

#### TreeView命令注册

命令注册以后，用户可以直接点击界面上的按钮向插件进程发送消息

```ts
const setKernelInOutBreakpointsCmd = vscode.commands.registerCommand(
    "code-debug.setKernelInOutBreakpoints",
    () => {
        vscode.debug.activeDebugSession?.customRequest("setKernelInBreakpoints");
        vscode.window.showInformationMessage("Kernel In Breakpoints Set");
    }
);
```

弹出消息窗口

```ts
vscode.window.showInformationMessage("message"):
```

详见`src/frontend/extension.ts`

#### 插件进程 <==> Debug Adapter

1. 插件进程 --> Debug Adapter

   ```ts
   vscode.debug.activeDebugSession?.customRequest("requestName");
   ```

2. Debug Adapter解析customRequest

   ```ts
   protected customRequest(command: string, response: DebugProtocol.Response, args: any): void {
       switch (command) {
           case "requestName":
           this.sendEvent({ event: "eventName", body: ["test"] } as DebugProtocol.Event);
           this.sendResponse(response);
           break;
   ```

3. 插件进程监听Events和Responses

   ```ts
   	let disposable = vscode.debug.registerDebugAdapterTrackerFactory("*", {
   	createDebugAdapterTracker() {
   		return {
   			//监听VSCode即将发送给Debug Adapter的消息
   			onWillReceiveMessage:(message)=>{
   			    //...   	
   			},
   			onWillStartSession: () => { console.log("session started") },
   			//监听Debug Adapter发送给VSCode的消息
   			onDidSendMessage: (message) => {
                   //...
   				if (message.type === "event") {
   					//...
   					}//处理自定义事件
   					else if (message.event === "eventTest") {
   						//Do Something
   					}
   ```

详见`src/frontend/extension.ts`、`src/mibase.ts`

#### Debug Adapter <===> Backend

以setBreakPointsRequest为例：

```ts
    // src/mibase.ts
	//设置某一个文件的所有断点
	protected setBreakPointsRequest(response: DebugProtocol.SetBreakpointsResponse, args: DebugProtocol.SetBreakpointsArguments): void {
        //clearBreakPoints()、addBreakPoint() 实现见src/backend/mi2/mi2.ts
		this.miDebugger.clearBreakPoints(args.source.path).then(() => { //清空该文件的断点
            //......
			const all = args.breakpoints.map(brk => {
				return this.miDebugger.addBreakPoint({ file: path, line: brk.line, condition: brk.condition, countCondition: brk.hitCondition });
			});
            // ......
			
```

详见src/mibase.ts

#### GDB命令

- `add-symbol-file`
- `break`

详细的输出及返回数据的格式可参考[官方文档](https://sourceware.org/gdb/onlinedocs/gdb/GDB_002fMI.html#GDB_002fMI)


### 关键的寄存器和内存的数据获取

VSCode 其实提供了几个重要的原生 request 接口，如 variablesRequest，其功能是展示 debugger 页中，左边VARIABLES 中变量的名字与值。每当 VSCode 的代码调试发生了暂停，VSCode 都会自动发送一个variablesRequest 向 DA 请求变量数据，那么我们只需要实现自定义的 variablesRequest，就可以做到自定义数据，如下我们可以在 TreeView 里展示寄存器

![vscode-scope](./docs/imgs/vscode-scope.png)



### 断点检测与切换

1. 当增删断点或`stopped`事件发生时，向Debug Adapter请求当前所有的断点信息（以及哪些断点被设置，哪些被缓存）

```ts
    //extension.ts
    onDidSendMessage: (message) => {
        if (message.command === "setBreakpoints"){//如果Debug Adapter设置了一个断点
            
            vscode.debug.activeDebugSession?.customRequest("update");
        }
        if (message.type === "event") {
            //...
            //如果（因为断点等）停下
            if (message.event === "stopped") {
                //更新寄存器信息
				//更新断点信息
                vscode.debug.activeDebugSession?.customRequest("update");   
            }
    //...
```

2. 当用户设置新断点时，判断这个断点能否在当下就设置，若否,则保存（VSCode编辑器和DA的断点是分离的，Debug Adapter不能控制编辑器的断点，故采用这种设计。见[此](https://stackoverflow.com/questions/55364690/is-it-possible-to-programmatically-set-breakpoints-with-a-visual-studio-code-ext)）

```ts
//src/mibase.ts-MI2DebugSession-setBreakPointsRequest
    protected setBreakPointsRequest(
		response: DebugProtocol.SetBreakpointsResponse,
		args: DebugProtocol.SetBreakpointsArguments
	): void {
		this.miDebugger.clearBreakPoints(args.source.path).then(
			() => {
				//清空该文件的断点
				const path = args.source.path;
				const spaceName = this.addressSpaces.pathToSpaceName(path);
				//保存断点信息，如果这个断点不是当前空间的（比如还在内核态时就设置用户态的
				//断点），暂时不通知GDB设置断点。
				//如果这个断点是当前地址空间，或者是内核入口断点，那么就通知GDB立即设置断点
				if ((spaceName === this.addressSpaces.getCurrentSpaceName())
				|| (path==="src/trap/mod.rs" && args.breakpoints[0].line===30)
				) {
					// TODO rules can be set by user
					this.addressSpaces.saveBreakpointsToSpace(args, spaceName);
					
				} 
				else {
					this.sendEvent({
						event: "showInformationMessage",
						body: "Breakpoints Not in Current Address Space. Saved",
					} as DebugProtocol.Event);
					this.addressSpaces.saveBreakpointsToSpace(args, spaceName);
					return;
				}
                //令GDB设置断点
				const all = args.breakpoints.map((brk) => {
					return this.miDebugger.addBreakPoint({
						file: path,
						line: brk.line,
						condition: brk.condition,
						countCondition: brk.hitCondition,
					});
				});
			//...
        //更新断点信息
		this.customRequest("update",{} as DebugAdapter.Response,{});
	}
```

3. 当断点组切换（比如从内核态进到用户态），令GDB移除旧断点（断点信息仍然保存在`MIDebugSession.AddressSpaces.spaces`中），设置新断点。见`src/mibase.ts-AddressSpaces-updateCurrentSpace`。

### 到达内核边界时的处理

#### 启动之后第一次进入内核

触发断点时，检测这个断点是否是内核边界的断点。

```typescript
    //src/mibase.ts 
    protected handleBreakpoint(info: MINode) {
        //...
        if (this.addressSpaces.pathToSpaceName(info.outOfBandRecord[0].output[3][1][4][1])==='kernel'){//如果是内核即将trap入用户态处的断点
            this.addressSpaces.updateCurrentSpace('kernel');
            this.sendEvent({ event: "inKernel" } as DebugProtocol.Event);
            if (info.outOfBandRecord[0].output[3][1][3][1] === "src/trap/mod.rs" && info.outOfBandRecord[0].output[3][1][5][1] === '135') {
                this.sendEvent({ event: "kernelToUserBorder" } as DebugProtocol.Event);//发送event
            }
        }
        //...
    }
```

若是，添加符号表文件，移除当前所有断点，加载用户态程序的断点。

```    ts
//extension.ts    
else if (message.event === "kernelToUserBorder") {
    //到达内核态->用户态的边界
    // removeAllCliBreakpoints();
    vscode.window.showInformationMessage("will switched to " + userDebugFile + " breakpoints");
    vscode.debug.activeDebugSession?.customRequest("addDebugFile", {
        debugFilepath:
            os.homedir() +
            "/rCore-Tutorial-v3/user/target/riscv64gc-unknown-none-elf/release/" +
            userDebugFile,
    });
    vscode.debug.activeDebugSession?.customRequest(
        "updateCurrentSpace",
        "src/bin/" + userDebugFile + ".rs"
    );

```

#### 进入用户态以后，想要再次进入内核

点击gotokernel按钮，判断当前要设置的断点是不是内核入口断点，如果是直接通知GDB添加断点。

```    ts
//src/mibase.ts 	
    case "goToKernel":
			this.setBreakPointsRequest(
				response as DebugProtocol.SetBreakpointsResponse,
				{
					source: { path: "src/trap/mod.rs" } as DebugProtocol.Source,
					breakpoints: [{ line: 30 }] as DebugProtocol.SourceBreakpoint[],
				} as DebugProtocol.SetBreakpointsArguments
			);
			this.sendEvent({ event: "trap_handle" } as DebugProtocol.Event);				
			break;

//src/mibase.ts
	protected setBreakPointsRequest(
		response: DebugProtocol.SetBreakpointsResponse,
		args: DebugProtocol.SetBreakpointsArguments
	): void {
		this.miDebugger.clearBreakPoints(args.source.path).then(
			() => {
				//清空该文件的断点
				const path = args.source.path;
				const spaceName = this.addressSpaces.pathToSpaceName(path);
				//保存断点信息，如果这个断点不是当前空间的（比如还在内核态时就设置用户态的断点），暂时不通知GDB设置断点
				//如果这个断点是当前地址空间，或者是内核入口断点，那么就通知GDB立即设置断点
				if ((spaceName === this.addressSpaces.getCurrentSpaceName()) || (path==="src/trap/mod.rs" && args.breakpoints[0].line===30)
				) {
					// TODO rules can be set by user
					this.addressSpaces.saveBreakpointsToSpace(args, spaceName);					
				} 
				else {
					this.sendEvent({
						event: "showInformationMessage",
						body: "Breakpoints Not in Current Address Space. Saved",
					} as DebugProtocol.Event);
					this.addressSpaces.saveBreakpointsToSpace(args, spaceName);
					return;
				}
				//令GDB设置断点
				const all = args.breakpoints.map((brk) => {
					return this.miDebugger.addBreakPoint({
						file: path,
						line: brk.line,
						condition: brk.condition,
						countCondition: brk.hitCondition,
					});
				});        
```

更新当前地址空间，更新符号表，

```    ts
//extension.ts
	else if (message.event === "trap_handle") {							
					//vscode.window.showInformationMessage("switched to trap_handle");
					vscode.debug.activeDebugSession?.customRequest("addDebugFile", {
						debugFilepath:
							os.homedir() +
							"/rCore-Tutorial-v3/os/target/riscv64gc-unknown-none-elf/release/os",
					});
					vscode.debug.activeDebugSession?.customRequest(
						"updateCurrentSpace",
						"src/trap/mod.rs"
					);
```

### 符号信息的获取

以下涉及的所有修改[见此](./docs/rCore-mod.diff)

#### 编译

通过修改`Cargo.toml`里的`debug=true`，`opt-level=0`两个参数使得rust编译器在编译时保留DWARF信息。

#### rCore的修改

rCore-Tutorial为了提升性能，在用户程序链接脚本`linker.ld`里面discard了`.debug_info`等段，修改链接脚本可以让链接器不忽略这些调试信息段。但这导致easy-fs的崩溃和栈溢出，故还需将easy-fs-fuse打包程序的磁盘大小，和栈空间改大。此外，user/目录要先 make clean 再编译，修改过的linkerscript才会生效。

### 界面美化
![coredebugger-screenshot-bootstrap-mid](./docs/imgs/code-debug UI.png)

## 总结与展望

项目的主要工作：

1. 在VSCode编辑器的已有debugger插件基础上，扩展对Rust语言和操作系统内核特征的源代码级跟踪分析能力。主要包括：
   - 关键的寄存器和内存的数据获取；
   - 当前特树级信息的准确获取；
   - 函数调用栈跟踪；
   - 一个例子：在USM三态修改符号表，并获取内存单元信息；
   - 对被跟踪内核运行环境的适配：QEMU

2. 通过docker容器提供在线版本vscode、rust工具链以及qemu-system-riscv64等调试rCore-Tutorial-v3所需要的工具，使用户可通过网页远程调用云端qemu/RISC-V开发板的gdb调试器进行代码跟踪与调试。该部分已基本完成，见docker文件夹。待debugger插件功能稳定后上传docker hub。

todos:

- 支持展示更多内核数据结构，比如进程控制块
- 上传到VSCode插件商店
- 对多进程提供更好的支持
- 改用地址空间来判断当前特权级
- 多处理机支持
- 不用WebView，改用TreeView
- 整理代码，抽象出项目核心，移植到vim/emacs......
- 支持watchpoint
- 支持真实硬件
- 在边界时如需自动切换符号文件，那么需要知道切换到哪个用户态程序。但是，我们只有在用户态程序的断点被触发之后，才能知道切换到哪个用户态程序。所以我建议这个功能不做了，改成用户手动设置符号表文件，想看哪个用户态程序就加载哪个用户态程序的符号表文件。在现在版本的代码中，仍然自动切换到initproc。
- 用户程序现在没开opt-level=0,感兴趣的同学可以试试能不能打开


## 安装与使用

### 安装-方法1-自动配置脚本

#### 请保证你的磁盘空间足够大，建议70G

#### 安装Ubuntu

[解决安装Ubuntu找不到“继续”按钮的问题](https://blog.csdn.net/weixin_54630384/article/details/127767424?spm=1001.2101.3001.6650.7&utm_medium=distribute.pc_relevant.none-task-blog-2%7Edefault%7EBlogCommendFromBaidu%7ERate-7-127767424-blog-120077249.235%5Ev38%5Epc_relevant_anti_vip_base&depth_1-utm_source=distribute.pc_relevant.none-task-blog-2%7Edefault%7EBlogCommendFromBaidu%7ERate-7-127767424-blog-120077249.235%5Ev38%5Epc_relevant_anti_vip_base&utm_relevant_index=8)

[vmware和主机间复制粘贴文件、文字_](https://blog.csdn.net/stanlyYP/article/details/127107448)

[ubuntu中文输入法无法打中文的解决办法](https://blog.csdn.net/qq_39810051/article/details/131981407)

[VMware共享文件夹设置](https://blog.csdn.net/weixin_54051652/article/details/128316296)

#### 下载仓库

```plain
git clone https://github.com/chenzhiy2001/code-debug
git clone --recursive https://github.com/chenzhiy2001/rcore-ebpf
```

#### 配置环境

1. 将code-debug中的test.sh换到在home目录下运行
2. 执行chmod +x test.sh命令，为文件添加权限
3. 执行./test.sh，开始执行，请保证网络畅通，可能要很长时间(期间若遇到某个部分无法安装的问题，采用手动安装再继续）
4. 执行完毕后配置环境变量：
```plain
vim ~/.bashrc
在.bashrc最后面添加以下语句
export PATH=$PATH:/home/zly/qemu-system-riscv64/build
export PATH=$PATH:/opt/riscv/bin
退出
source ~/.bashrc
```
5. 使用命令检查是否安装成功：
    1. rustc --version   (rustc 1.74.0-nightly (59a829484 2023-08-30))
    2. npm -v  (版本在9以上)
    3. node -v (版本在18以上)
    4. qemu-system-riscv64 --version  （QEMU emulator version 7.0.0）
    5. /opt/riscv/bin/riscv64-unknown-elf-gdb  （出现（gdb命令行，输入以下命令，有输出的话，表示有python支持））
```plain
(gdb) python
print("114514")
end 
```
6. 如果还是有问题请查看test.sh文件，里面用回车符隔开了下载各个工具的命令，可以把它单独复制出来到新的文件重新运行
#### 安装vscode

1. [Download Visual Studio Code - Mac, Linux, Windows](https://code.visualstudio.com/Download)下载.deb
2. 执行下面命令，注意换文件名
```plain
 sudo dpkg -i code_1.71.2-1663191218_amd64.deb
```

#### 编译rcore-ebpf

* 修改user/ebpf/build.sh里面的路径
* 修改os/Cargo.toml中的ruprobes
```
ruprobes = { git = "https://github.com/chenzhiy2001/ruprobes", features = ["rCore-Tutorial"] }
```
* 在 os 中 make run
* 如果遇到需要更高的nightly版本但是更新后仍出现此错误
在rust-toolchain.toml中将channel改为更新后的版本

* 如果在编译过程中遇到“找不到clang-12”报错，执行下面命令
```plain
sudo apt-get install clang-12
```
* 安装cmake 命令：
```plain
sudo apt-get install cmake
```
* 如果遇到“ riscv64-linux-musl-gcc未找到”
在musl.cc下载 riscv64-linux-musl-cross.tgz 并解压到主目录，将riscv64-linux-musl-cross/bin 加入环境变量：

```plain
export PATH=$PATH:/home/path/to/riscv64-linux-musl-cross/bin
```
*  编译时出现 unsafe {kprobes_breakpoint_handler(&mut *(_trap_cx as *const TrapContext as *mut TrapContext));} // ugly :( 语句报错
尝试以下修改
```
unsafe {kprobes_breakpoint_handler(_trap_cx);}
```

* launch.json文件，记得修改路径

### 安装-方法2-手动安装

#### 环境配置

流程略长，如果出现问题欢迎提issue. rCore-Tutorial-Code-2023S的安装方法见[这里](./docs/2023S.md)


1. 推荐用ubuntu20.04虚拟机。其它版本请确保使用较新的`npm`和`node`。

1. 安装 vscode（Ubuntu中下载的vscode不能输入中文，可以参考[这篇文章](https://blog.csdn.net/mantou_riji/article/details/123379045?utm_medium=distribute.pc_aggpage_search_result.none-task-blog-2~aggregatepage~first_rank_ecpm_v1~rank_v31_ecpm-1-123379045-null-null.pc_agg_new_rank&utm_term=vscode%E8%BE%93%E5%85%A5%E4%B8%8D%E4%BA%86%E4%B8%AD%E6%96%87&spm=1000.2123.3001.4430)）

1. Rust 开发环境配置，qemu安装，可以参考[rCore指导书](https://rcore-os.github.io/rCore-Tutorial-Book-v3/chapter0/5setup-devel-env.html)，也可以使用下面命令直接安装

   ```
   Rust 开发环境配置主要步骤如下：
   sudo apt install curl //要用apt安装curl
   curl https://sh.rustup.rs -sSf | sh
   source $HOME/.cargo/env
   rustup install nightly
   rustup default nightly
   
   qemu安装
   # 安装编译所需的依赖包
   sudo apt install autoconf automake autotools-dev curl libmpc-dev libmpfr-dev libgmp-dev \
                 gawk build-essential bison flex texinfo gperf libtool patchutils bc \
                 zlib1g-dev libexpat-dev pkg-config  libglib2.0-dev libpixman-1-dev libsdl2-dev \
                 git tmux python3 python3-pip ninja-build coreutils xautomation xdotool
   # 下载源码包
   # 如果下载速度过慢可以使用我们提供的百度网盘链接：https://pan.baidu.com/s/1dykndFzY73nqkPL2QXs32Q
   # 提取码：jimc
   wget https://download.qemu.org/qemu-7.0.0.tar.xz
   # 解压
   tar xvJf qemu-7.0.0.tar.xz
   # 编译安装并配置 RISC-V 支持
   
   cd qemu-7.0.0

   ./configure --target-list=riscv64-softmmu,riscv64-linux-user  # 如果要支持图形界面，可添加 " --enable-sdl" 参数

   make -j$(nproc)
   
   #配置qemu环境变量：
   #编辑~/.bashrc文件，在最后一行添加下面语句：
   export PATH=$PATH:/path/to/qemu-7.0.0/build
   # 注意，执行以上操作时，不能直接复制粘贴,要把/path/to改成qemu所在的文件夹。
   # 另外，执行完以上操作后，要重启终端才能成功添加环境变量。若配置qemu失败，不妨输入$PATH查看环境变量有没有正确添加。

   
   #此时我们可以确认 QEMU 的版本：
   qemu-system-riscv64 --version
   qemu-riscv64 --version
   ```

1. npm安装，尽量安装较新的版本

   ```
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   #查看版本信息
   node --version
   npm --version
   ```

1. 获取risc-v工具链 在[sifive官网](https://www.sifive.com/software)下载risc-v工具链或者试试直接访问[这里](https://static.dev.sifive.com/dev-tools/riscv64-unknown-elf-gcc-8.3.0-2020.04.1-x86_64-linux-ubuntu14.tar.gz)。下载后将该文件复制到home目录下并解压，将其中的bin/文件夹加入环境变量.

    > Sifive官网提供的工具链没有python支持，因此，如果想用ebpf side-stub，我们要自己编译一份工具链：(更多信息见<https://github.com/riscv-collab/riscv-gnu-toolchain/issues/925>)
    > 
    > 确保有 15GiB 剩余硬盘空间
    > 
    > `sudo apt install python-is-python3`
    > 
    > `sudo apt-get install autoconf automake autotools-dev curl python3 libmpc-dev libmpfr-dev libgmp-dev gawk build-essential bison flex texinfo gperf libtool patchutils bc zlib1g-dev libexpat-dev ninja-build`
    > 
    > `sudo apt install python3-dev`
    > 
    > `git clone https://github.com/riscv/riscv-gnu-toolchain`
    > 
    > `cd riscv-gnu-toolchain`
    > 
    > `./configure --prefix=/opt/riscv`
    > 
    > `sudo make`
    > 
    > 就可以自动下载、编译。编译完成后，
    >
    > `/opt/riscv/bin/riscv64-unknown-elf-gdb`
    > 
    > `(gdb) python`
    > 
    >  `print("114514")`
    > 
    >  `end`
    >
    > 如果gdb输出`114514`就表示有python支持。
    > 
    > 最后将`/opt/riscv/bin`加入PATH。如果之前将sifive提供的工具链也加入了PATH，应该要把它去掉。
    >
    > 如果你的python没有pyserial模块，应该安装一下：
    > 
    > `pip3 install pyserial`
    >
    > 如果想用venv, 可以参考[这篇文章](https://interrupt.memfault.com/blog/using-pypi-packages-with-gdb)。



1. 下载rCore-Tutorial-v3，需要修改rCore-Tutorial-v3的源码和编译参数，下载[这个仓库](https://github.com/chenzhiy2001/rCore-Tutorial-v3)修改过的rCore-Tutorial-v3，建议下载到home目录，下载之后跑一遍rCore-Tutorial-v3。


1. clone 本仓库(code-debug)，建议clone到home目录

#### 待调试OS的配置

1. 在仓库目录下(.../code-debug)运行 npm install 命令

1. 在vscode中打开本项目，按F5执行，会弹出一个新的窗口

1. 在新窗口中打开rcore-ebpf项目，在 .vscode 文件夹中添加 launch.json文件，并输入以下内容，然后保存并再编译一遍rCore，接着在新窗口内按F5就可以启动gdb并调试。

   如果GDB并没有正常启动，可以尝试把下面的gdbpath改成绝对路径(如“/home/username/riscv64-unknown-elf-toolchain-10.2.0-2020.12.8-x86_64-linux-ubuntu14/bin”)。

   ```
   //launch.json
   {
       "version": "0.2.0",
       "configurations": [
           {
               "type": "gdb",
               "request": "attach",
               "name": "Attach to Qemu",
               "executable": "${userHome}/rcore-ebpf/os/target/riscv64gc-unknown-none-elf/release/os",
               "target": ":1234",//不能和Qemu开放的tcp端口重叠
               "remote": true,
               "cwd": "${workspaceRoot}",
               "valuesFormatting": "parseText",
               "gdbpath": "riscv64-unknown-elf-gdb",
               "showDevDebugOutput":true,
               "internalConsoleOptions": "openOnSessionStart",
               "printCalls": true,
               "stopAtConnect": true,
               "qemuPath": "qemu-system-riscv64",
               "qemuArgs": [
                   "-M",
                   "128m",
                   "-machine",
                   "virt",
                   "-bios",
                   "${userHome}/rcore-ebpf/bootloader/rustsbi-qemu.bin",
                   "-display",
                   "none",
                   "-device",
                   "loader,file=${userHome}/rcore-ebpf/os/target/riscv64gc-unknown-none-elf/release/os.bin,addr=0x80200000",
                   "-drive",
                   "file=${userHome}/rcore-ebpf/user/target/riscv64gc-unknown-none-elf/release/fs.img,if=none,format=raw,id=x0",
                   "-device",
                   "virtio-blk-device,drive=x0",
                   "-device",
                   "virtio-gpu-device",
                   "-device",
                   "virtio-keyboard-device",
                   "-device",
                   "virtio-mouse-device",
                   "-serial",
                   "stdio",
                   "-serial",
                   "pty",
                   "-s",
                   "-S"
               ],
            "userSpaceDebuggeeFolder": "${userHome}/rcore-ebpf/user/target/riscv64gc-unknown-none-elf/release",
            "KERNEL_IN_BREAKPOINTS_LINE":65, // src/trap/mod.rs中内核入口行号。可能要修改
            "KERNEL_OUT_BREAKPOINTS_LINE":124, // src/trap/mod.rs中内核出口行号。可能要修改
            "GO_TO_KERNEL_LINE":30, // src/trap/mod.rs中，用于从用户态返回内核的断点行号。在rCore-Tutorial-v3中，这是set_user_trap_entry函数中的stvec::write(TRAMPOLINE as usize, TrapMode::Direct);语句。
            "KERNEL_IN_BREAKPOINTS_FILENAME":"${userHome}/rcore-ebpf/os/src/trap/mod.rs",
            "KERNEL_OUT_BREAKPOINTS_FILENAME":"${userHome}/rcore-ebpf/os/src/trap/mod.rs",
            "GO_TO_KERNEL_FILENAME":"",
            "kernel_memory_ranges":[["0xefffffffffffffff","0xffffffffffffffff"]],
            "user_memory_ranges":[["0x0000000000000000","0xe000000000000000"]]
           },
       ]
   }
   ```
    - 这里解释一下`KERNEL_IN_BREAKPOINTS_LINE`和`GO_TO_KERNEL_LINE`的区别。以rCore-Tutorial-v3为例，`KERNEL_IN_BREAKPOINTS_LINE`对应`trap_return`函数的断点，而`GO_TO_KERNEL_LINE`对应`trap_return`函数调用的`set_user_trap_entry`子函数的断点。而`set_user_trap_entry`子函数实际上只有一行语句：`stvec::write(TRAMPOLINE as usize, TrapMode::Direct);`。也就是说，`KERNEL_IN_BREAKPOINTS_LINE`指向中断处理例程，而`GO_TO_KERNEL_LINE`精确地指向中断处理例程中的`stvec::write(TRAMPOLINE as usize, TrapMode::Direct);`语句。
1. 为了用eBPF Panel，需要在rCore-Tutorial-v3的根目录下添加一个脚本：

```shell
tty > ./qemu_tty
qemu-system-riscv64 "$@" | tee ./code_debug_qemu_output_history.txt
```
将这个脚本命名为`qemu-system-riscv64-with-logs.sh`，添加可执行权限（`chmod +x qemu-system-riscv64-with-logs.sh`），然后将刚才launch.json中的`"qemuPath": "qemu-system-riscv64"`改为`"qemuPath": "${workspaceRoot}/qemu-system-riscv64-with-logs.sh"`.

1. （可选）如果你要用rust-gdb，先保证你的GDB有Python支持（前文有介绍怎么添加Python支持）然后在rCore-Tutorial-v3的根目录下添加一个脚本：
```shell
export RUST_GDB=riscv64-unknown-elf-gdb
rust-gdb "$@"
```
将这个脚本命名为`riscv64-unknown-elf-gdb-rust.sh`，添加可执行权限，然后将刚才launch.json中的`"gdbpath": "riscv64-unknown-elf-gdb"`改为
`"gdbpath": "${workspaceRoot}/riscv64-unknown-elf-gdb-rust.sh"`.


`RUST_GDB=riscv64-unknown-elf-gdb`（一种方法是，在~/.bashrc里添加一行`export RUST_GDB=riscv64-unknown-elf-gdb`）然后将launch.json里的gdbpath改为`rust-gdb`.

### 使用

1. 在code-debug文件夹下`git pull`更新软件仓库，确保代码是最新的，然后按F5运行插件，这时会打开一个新的VSCode窗口。 **后续操作步骤均在新窗口内完成！**
1. 在新窗口内，打开rCore-Tutorial-v3项目，按照上面的提示配置`launch.json`并保存。
1. 按F5键，即可开始使用本插件。
1. 清除所有断点（removeAllCliBreakpoints按钮）
1. 设置内核入口（setKernelInBreakpoints按钮）、出口断点（setKernelOutBreakpoints按钮）
1. 设置内核代码和用户程序代码的断点（这里有个bug尚未解决：必须得在initproc.rs的println!语句或`fn main()`处设置断点）
1. 按continue按钮开始运行rCore-Tutorial
1. 当运行到位于内核出口的断点时，插件会自动切换到用户态的断点
1. 在用户态程序中如果想观察内核内的执行流，可以点击gotokernel按钮，然后点击继续按钮，程序会停在内核的入口断点，这时，可以先把内核出口断点设置好（点击setKernelOutBreakpoints按钮），接下来，可以在内核态设置断点，点击继续，运行到内核的出口断点之后，会回到用户态。

[视频演示](https://www.bilibili.com/video/BV1gW4y1x7ys/?spm_id_from=333.999.0.0&vd_source=ab418999e896fd33cc8eefbeab063d7f)

### 常见问题和解决办法
#### 只能打内核态断点，不能打用户态断点
很可能是因为边界断点失效。要解决这个问题，需要更改边界断点的位置。
以rCore-Tutorial-v3为例，我们来看它的trap_return函数，这个函数用于从内核态进到用户态。
```rust
122 #[no_mangle]
123 pub fn trap_return() -> ! {
124     disable_supervisor_interrupt();
125     set_user_trap_entry();
126     let trap_cx_user_va = current_trap_cx_user_va();
127     let user_satp = current_user_token();
128     extern "C" {
129         fn __alltraps();
130         fn __restore();
131     }
132     let restore_va = __restore as usize - __alltraps as usize + TRAMPOLINE;
133     //println!("before return");
134     unsafe {
135         asm!(
136             "fence.i",
137             "jr {restore_va}",
138             restore_va = in(reg) restore_va,
139             in("a0") trap_cx_user_va,
140             in("a1") user_satp,
141             options(noreturn)
142         );
143     }
144 }
```

我们发现，第170行之后中断被关闭了，中断关闭后这个执行流不会被打断（多核呢？）所以124，125，126，127行都可以作为边界断点，可以逐一尝试。128-134行经过测试发现会卡在132行不动。
如果边界断点是可行的（表现为，虽然用户态断点不能触发，但是右下角有提示进行了断点组切换）那就是gdb在设置用户态断点的时候发生了错误，导致 gdb 跟踪失败。这可能跟编译器有关系，目前有一个临时的解决办法，就是经过我们测试，第17行是可以正常工作的，其他行则不行：
```rust
1 #![no_std]
2 #![no_main]
3 
4 extern crate user_lib;
5 
6 use user_lib::{println, getpid};
7 
8 use user_lib::{exec, fork, wait, yield_};
9 
10 #[no_mangle]
11 fn main() -> i32 {
12 
13 
14     println!("aaaaaaaaaaaaaa");
15     let a = getpid();
16     println!("pid is {}",a);
17    
18 
19 
20     if fork() == 0 {
21         exec("user_shell\0", &[core::ptr::null::<u8>()]);
22     } else {
    //...
```


### 功能

#### 跟踪系统调用

用户->内核->用户

#### 跟踪内核数据结构

注：内核中的各种数据结构差异很大。此处列出可行的示例，欢迎感兴趣的大佬们继续添加

#### 直接观测内存

Ctrl+Shift+P memory

#### 断点组的自动切换

### 暂不可跟踪

#### Self变量

这是gdb的bug，见https://sourceware.org/gdb/onlinedocs/gdb/Rust.html

#### lazy_static! 变量（宏，返回值，难以跟踪）。如PCB,TCB

找到原因了。和lazy_static宏有关。简单来说，TASK_MANAGER结构体里确实只有__private_filed。TASK_MANAGER里的值通过宏里的deref()函数返回。函数返回值跟踪起来很麻烦，所以曲线救国，把TaskManager的地址复制到另一个全局变量里（这在c里很容易做到，在rust里略麻烦）。
不靠谱的方法：

#### 包含Vec和VecDeque的数据结构

Vec和VecDeque的pointer值通过gdb查看是错的（都是0x1,0x2之类的很小的值）。直接看内存可以得到正确结果

#### 被内联展开的函数

#### 一些库函数（比如up.rs）
这也是GDB的问题，不过通常用step over跳过就行了。

## 扩展

以下列出一些思路，结合[上文](#调试工具实现)，您可以容易地扩充本插件的功能：

### 支持其他OS

	- 获取符号表信息（例如vmlinux）
	- 确定内核“出入口”断点

### 观察其他内核数据结构

1. `stopped`(extension.ts)
1. 添加`customRequest`(mibase.ts)
   1. 收集数据：GDB命令（mi2.ts中的方法，或者直接用this.miDebugger.sendCliCommand）
   1. 返回信息：Events/Responses
1. 在treeiew上展示

### Multiple Debug File Support

1. `vscode.debug.activeDebugSession?.customRequest("addDebugFile`
2. memState into addressspaces
3. GDB Command：`add-file`

### Send GDB Command

1. with filter: addBreakpoints Request
2. without filter (brute force): sendCliCommand()


## 开发记录文档

### 2023年2月之后
见[这里](./README-OSComp2023.md)

### 2022-2023年2月
- [在线版本(观看效果更佳)](https://shimo.im/docs/hRQk6dXkxHp9pR3T)
- [（待更新）离线版本](./docs/%E5%BC%80%E5%8F%91%E8%AE%B0%E5%BD%95%E5%92%8C%E7%9F%A5%E8%AF%86%E5%BA%93.pdf)

## 共建时遵循的规范

仓库提供了 CI，在 push 到远程仓库后会自动执行一些检查的脚本，在提交 commit 前应当执行以下命令，在均无问题后再 push

```bash
// 对文档进行格式化
npm run prettier-write-docs

// 检查文档格式，出现 
// "All matched files use Prettier code style!" 代表成功
npm run prettier-check-docs

// 检查代码规范，没有 error 即成功
npm run lint

// 进行单元测试
npm run test
```
