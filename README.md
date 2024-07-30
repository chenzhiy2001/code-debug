
# Proj158-支持Rust语言的源代码级内核调试工具
### 项目仓库

| 仓库名                    | 仓库描述                                                     | Github 地址                                                 | commit数量  （去年九月至今）                                  |
| ------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------- | ------------------------------------------------------------ |
| code-debug                | 本仓库                                                       | <https://github.com/chenzhiy2001/code-debug>                | 108                                                          |
| ruprobes                  | 我们移植的uprobe模块和详细的移植文档                         | <https://github.com/chenzhiy2001/ruprobes>                  | 0                                                            |
| rcore-ebpf(全小写)        | 整合了ebpf,kprobe,uprobe模块的rCore-Tutorial-v3              | <https://github.com/chenzhiy2001/rcore-ebpf>                | 1                                                            |
| uCore-Tutorial-Test-2022A | rcore-ebpf的C程序支持                                        | <https://github.com/chenzhiy2001/uCore-Tutorial-Test-2022A> | 0                                                            |
| trap_context_riscv        | trap_context crate （用于uprobe移植）                        | <https://github.com/chenzhiy2001/trap_context_riscv>        | 0                                                            |
| rCore-Tutorial-v3         | 修改版rCore-Tutorial-v3，主要包括多个实验分支的调试器部分功能适配，以及main分支的调试器全功能适配 | <https://github.com/chenzhiy2001/rCore-Tutorial-v3>         | 0                     |
| qemu-system-riscv64       | 修改版的Qemu虚拟机                                           | <https://github.com/chenzhiy2001/qemu-system-riscv64>       | 0 |
| rustsbi-qemu              | 修改版的RustSBI                                              | <https://github.com/chenzhiy2001/rustsbi-qemu>              | 0 |

### 去年的工作概要：

构建了一款支持Rust操作系统内核开发的源代码级调试工具，该工具具备如下特征：    
(1)基于QEMU和GDB，支持跨内核态和用户态的源代码跟踪调试;    
(2)基于eBPF，支持开发板上跨内核态和用户态的性能分析检测;    
(3)基于VScode构建了远程开发环境，支持断点调试与性能检测的功能结合。

### 获得的成就：
2023年全国大学生计算机系统能力大赛操作系统赛功能挑战赛全国特等奖

### 遗留的问题：
1. 调试器自动设置的断点不会在 VSCode 里面显示出来的问题
2. 若内核的出入口断点均在内核的符号表里，在用户态运行时内核的符号表已经卸载，无法触发边界断点回到内核态。
3. 代码实现很麻烦且难以维护
4. mibase.ts 中无法使用 console.log
5. 在没有跳板页，且是双页表的 OS 的情况下， continue不能跳转到断点

# 今年的工作：
#### 工作概要：    
+ [对去年工作的完善](#对去年工作的完善)     
1.[解决由调试器自动设置的断点不会在 VSCode 里面显示出来的问题](#完善1)    
2.[完善边界断点](#完善2)    
3. [将断点组功能改造为状态机](#完善3)    
4. [添加 showInformationMessage 函数](#完善4)    
5. [改善有的情况continue不能跳转到断点的情况](#完善5)
  
+ [新的工作](#新的工作)    
1. [增加通过SSH进行OS调试的功能](#新1)    
2. [提升 Debug Console 输出内容的可读性](#新2)    
3. [修改launch.json 文件](#新3)    
4. [通过右键菜单添加/取消边界断点](#新4)    
5. [修改插件本身的编译配置文件 tsconfig.json](#新5)    
6. [让调试器适配xv6](#新6)

#### 后续工作安排：
- 结合硬件
  
#### 详细工作总结如下所示

<span id="对去年工作的完善"></span>
## 对去年工作的完善：

<span id="完善1"></span>
### 1. 解决由调试器自动设置的断点不会在 VSCode 里面显示出来的问题
+ 在过去，由于VSCode没有提供“在VSCode中设置断点”的API，我们的插件无法模拟用户设置断点的操作。我们如果想要自动地设置断点，只能从Debug Adapter入手，让Debug Adapter知道断点设置了，然后再告诉GDB，但是VSCode是根本不知道这个断点存在的，因此不会显示出来。  

现在，VSCode在某个更新中增加了“在VSCode中设置断点”的API，我们的插件可以利用这个API来模拟用户设置断点的操作，这样VSCode知道了断点的存在，断点就可以了显示出来了。

<span id="完善2"></span>
### 2. 完善边界断点

- 去年的工作将边界断点独立于断点组，若内核的出入口断点均在内核的符号表里，在用户态运行时内核的符号表以及卸载，无法触发边界断点回到内核态。  

在实际实现时将边界断点包含在断点组中，支持动态设置和取消（但是逻辑上仍然独立于断点组）。
我们选择的方法是直接设置边界断点，所有地方都用完整的文件路径来解决断点组名字和断点文件名的对应的问题。

微软提供了足够多的 API 来实现我们的功能。由于 Breakpoint 的构造方法是 protected 的，而且插件的代码里面有三个 Breakpoint 类:vscode.Breakpoint, DAP 的 breakpoint，DAP 后端（mi2.ts）的 breakpoint。我们把 isBorder 这个属性交给断点组管理模块去管理。因此，在 Debug Adapter 层面是先设置断点，再给断点添加“边界”属性的。（在 VSCode 的层面则不是）

```ts
	vscode.debug.addBreakpoints([breakpoint]);//this will go through setBreakPointsRequest in mibase.ts
	vscode.debug.activeDebugSession?.customRequest('setBreakpointAsBorder',args[0]);

```
由于Debug Adapter 会对这些断点做很多的操作，把断点组和 Debug Adapter 本身的断点管理功能合为一体不是好事，怕会造成更多麻烦。之前在断点组里面直接存SetBreakpointArguments，而不是 BreakpointGroupBrks 之类的策略没有问题，因为断点组管理模块的作用就是在合适的时机进行断点设置，而非存储某个断点。而且 SetBreakpointArguments 里面已经包含了断点所需要的所有信息。只不过我们要继承 SetBreakpointArguments，添加一个 isBorder 属性。然后通过 customRequest 对这个 isBorder 属性做更改。对于怎么找到某个 SetBreakpointArguments，暴力查找已经是风险最低的办法。唯一的优化措施是先通过用户提交的地址转断点组函数，找到断点组，再在断点组里面暴力查找。但是考虑到用户不会设置很多断点，这么做没有太大意义。

回到“设置断点-断点偏移-用户把偏移后的断点设置为边界”的方案，这样就不用解决断点偏移的问题。同时，边界的信息并不存储在断点的数据结构里，而是存在断点组的数据结构里，这样就不用去查找到某个断点的数据结构，再将它改为“边界”。
这样做还有一个好处，无需改动原有的断点数据结构（因为边界的信息不再存储在断点的数据结构中，而是存在断点组的属性中）。再增加一个“去除本地址空间的边界断点”功能，就同时实现了边界断点的更改。至于把边界断点改回普通断点的功能就没有必要了。
断点组切换的代码除了完全清空所有断点组信息（removeallclibreakpoint）的情况外，断点组本身是不会被删除的（断点组里面的断点可能会被删除）。因此我们把边界的信息附加在断点组上，做到了和之前代码的兼容，因此代码量小，现有的断点组切换的代码完全不需要更改。

```ts


	//There is only 1 border per breakpoint group. So it you set border twice in a breakpoint group, the newer one will replace the older one.
	const setBreakpointAsBorderCmd = vscode.commands.registerCommand('code-debug.setBreakpointAsBorder', (...args) => {
		const uri = args[0].uri;
		const fullpath = args[0].uri.fsPath; // fsPath provides the path in the form appropriate for the os.
		const lineNumber = args[0].lineNumber;
		// we set the line index to 0 since currently we don't want to deal with positions in a line
		let breakpoint = new vscode.SourceBreakpoint(new vscode.Location(uri,new vscode.Position(lineNumber,0)),true);
		vscode.debug.addBreakpoints([breakpoint]);//this will go through setBreakPointsRequest in mibase.ts
		vscode.debug.activeDebugSession?.customRequest('setBorder',new Border(fullpath,lineNumber));
	});

	//customRequest=======

				case 'setBorder':
				// args have border type
				this.breakpointGroups.updateBorder(args as Border);
				break;

	//====================

	public updateBorder(border: Border) {
		const result = eval(this.debugSession.filePathToBreakpointGroupNames)(border.filepath);
		const groupNamesOfBorder:string[] = result;
		for(const groupNameOfBorder of groupNamesOfBorder){
			let groupExists = false;
			for(const group of this.groups){
				if(group.name === groupNameOfBorder){
					groupExists = true;
					group.border = border;
				}
			}
			if(groupExists === false){
				this.groups.push(new BreakpointGroup(groupNameOfBorder, [], new HookBreakpoints([]), border));
			}
		}
	}

```

其中`filePathToSpaceName`函数是由用户在 launch.json 中提供的，因为 filepath=>SpaceName 的逻辑每个 OS都不一样。

除此之外我们加了一个把边界断点改回普通断点的功能：

```ts

	const disableBorderOfThisBreakpointGroupCmd = vscode.commands.registerCommand('code-debug.disableBorderOfThisBreakpointGroup', (...args) => {
		const uri = args[0].uri;
		const fullpath = args[0].uri.fsPath; // fsPath provides the path in the form appropriate for the os.
		const lineNumber = args[0].lineNumber;
		vscode.debug.activeDebugSession?.customRequest('disableBorder', new Border(fullpath, lineNumber));
	});


	//customRequest=========

				case 'disableBorder':
				// args have border type
				this.breakpointGroups.disableBorder(args);
				break;

	//=====================

	public disableBorder(border: Border) {
		const groupNamesOfBorder:string[] = eval(this.debugSession.filePathToBreakpointGroupNames)(border.filepath);
		for(const groupNameOfBorder of groupNamesOfBorder){
			let groupExists = false;
			for(const group of this.groups){
				if(group.name === groupNameOfBorder){
					groupExists = true;
					group.border = undefined;
				}
			}
			if(groupExists === false){
				//do nothing
			}
		}
	}
```
如果没给边界的话就不会切换断点组，就在当前断点组一直运行下去。

<span id="完善3"></span>
### 3. 将断点组功能改造为状态机

由于之前代码之前散落在各处，没有可读性，而且许多代码实现起来很是复杂，我们决定将之前的代码状态机化来更清晰的描述行为和状态变化。

我们构造的状态机只管理 extension.ts，任何 mibase.ts 的操作都要提到 extension.ts 来完成。因为我们的调试器本质上是模拟用户操作，而用户操作的相关逻辑就是在 extension.ts 里实现的。  
我们的做法是：
维持原有的断点组，将状态机作为断点组上层的东西。  

#### 使用enum 总结所有我们要实现的功能：
```typescript
enum OSStates {
	kernel,
	kernel_single_step_to_user,
	user,
	user_single_step_to_kernel,
}

enum OSEvents {
	STOPPED,
	AT_KERNEL,
	AT_KERNEL_TO_USER_BORDER,
	AT_USER,
	AT_USER_TO_KERNEL_BORDER,
}

enum DebuggerActions {
	check_if_kernel_yet,
	check_if_user_yet,
	check_if_kernel_to_user_border_yet,
	check_if_user_to_kernel_border_yet,
	get_next_breakpoint_group_name,
	start_consecutive_single_steps,
	switch_breakpoint_group,
}
```
状态机里面将“自动单步”这些自动化操作表示为"actions"（类型为Actions[]，类似于iOS
的快捷指令）。  


#### 添加“钩子断点”

```ts
// use this to get next process name
class HookBreakpoint{
	breakpoint:Breakpoint;
	behavior:FunctionString;
	constructor(breakpoint:Breakpoint, behavior:FunctionString){
		this.breakpoint = breakpoint;
		this.behavior = behavior;
	}
}
```
停下时 STOPPED 事件发生，根据状态机，会触发`try_get_next_breakpoint_group_name` action。 这个action 的作用是，判断当前是否停在了 HookBreakpoint.breakpoint 上了。如果是的话，调用 behavior做信息收集的工作，把结果返回即可。  
利用 Function 构造函数，让用户可以把函数传进来：

```ts
//JSON: {"function":{"arguments":"a,b,c","body":"return a*b+c;"}}

var f = new Function(function.arguments, function.body);

```
这要求用户掌握我们`mibase.ts`里面的 API。但是这种设计的可扩展性很强，比较通用，以后要想完善断点组切换功能的话，只需要定义新的 behavior 和 environment 就可以。

#### 改变状态触发事件  
之前为了提供“停下”的信号，在四五个地方（断点触发，单步结束......）执行后发送“停下”的事件。
但是我们发现，stopEvent 确实会在每次 OS 停下来时被创建，只处理一种停下来的情况，不包括因为断点而停下来的情况。所以只要在 stopevent 一个地方设 stop 的“钩子断点”即可。

状态机的初始状态是"kernel"。当停下时，改变状态。

```ts
	stopEvent(info: MINode) {
		if (!this.started) this.crashed = true;
		if (!this.quit) {
			const event = new StoppedEvent("exception", parseInt(info.record("thread-id")));
			(event as DebugProtocol.StoppedEvent).body.allThreadsStopped =
				info.record("stopped-threads") == "all";
			this.sendEvent(event);
			if(this.OSDebugReady){
				this.recentStopThreadID = parseInt(info.record("thread-id"));
				this.OSStateTransition(new OSEvent(OSEvents.STOPPED));
			}
		}
	}
```

`this.OSStateTransition`方法做如下的事：

1. 通过`stateTransition`查询新状态和应做的 actions
2. 更新状态`this.OSState`，执行 actions

```ts
	public OSStateTransition(event: OSEvent){
		let actions:Action[];
		[this.OSState, actions] = stateTransition(this.OSStateMachine, this.OSState, event);
		// go through the actions to determine
		// what should be done
		actions.forEach(action => {this.doAction(action);});
	}
```

根据状态机，`kernel` 状态时触发 `STOPPED` event . 这种情况不会改变状态（或者说状态改变到 kernel 本身），但是会触发`check_if_kernel_to_user_border_yet` action.

```ts
		[OSEvents.STOPPED]: {
					target: OSStates.kernel,
					actions: [
						{ type: DebuggerActions.try_get_next_breakpoint_group_name }, //if got, save it to a variable. if not, stay the same. initial is "initproc"
						{ type: DebuggerActions.check_if_kernel_to_user_border_yet }, //if yes, event `AT_KERNEL_TO_USER_BORDER` happens
					]
				},
```
我们这个状态机的特别之处在于：一些 action 会导致 OSState 的变化。  
特殊的情况全部出现在`doAction`方法中：

```ts
	public doAction(action:Action){
		if(action.type === DebuggerActions.check_if_kernel_yet){
			this.showInformationMessage('doing action: check_if_kernel_yet');
			this.miDebugger.getSomeRegisters([this.program_counter_id]).then(v => {
				const addr = parseInt(v[0].valueStr, 16);
				if(this.isKernelAddr(addr)){
					this.showInformationMessage('arrived at kernel. current addr:' + addr.toString(16));
					this.OSStateTransition(new OSEvent(OSEvents.AT_KERNEL));
				}else{
					this.miDebugger.stepInstruction();
				}
			});
		}
		else if(action.type === DebuggerActions.check_if_user_yet){
			this.showInformationMessage('doing action: check_if_user_yet');
			this.miDebugger.getSomeRegisters([this.program_counter_id]).then(v => {
				const addr = parseInt(v[0].valueStr, 16);
				if(this.isUserAddr(addr)){
					this.showInformationMessage('arrived at user. current addr:' + addr.toString(16));
					this.OSStateTransition(new OSEvent(OSEvents.AT_USER));
				}else{
					this.miDebugger.stepInstruction();
				}
			});
		}
		// obviously we are at kernel breakpoint group when executing this action
		else if(action.type === DebuggerActions.check_if_kernel_to_user_border_yet){
			this.showInformationMessage('doing action: check_if_kernel_to_user_border_yet');
			let filepath:string = "";
			let lineNumber:number = -1;
			const kernelToUserBorderFile = this.breakpointGroups.getCurrentBreakpointGroup().border?.filepath;
			const kernelToUserBorderLine = this.breakpointGroups.getCurrentBreakpointGroup().border?.line;
			//todo if you are trying to do multi-core debugging, you might need to modify the 3rd argument.
			this.miDebugger.getStack(0, 1, this.recentStopThreadID).then(v=>{
				filepath = v[0].file;
				lineNumber = v[0].line;
				if (filepath === kernelToUserBorderFile && lineNumber === kernelToUserBorderLine){
					this.OSStateTransition(new OSEvent(OSEvents.AT_KERNEL_TO_USER_BORDER));
				}
			});
		}
		// obviously we are at current user breakpoint group when executing this action
		else if(action.type === DebuggerActions.check_if_user_to_kernel_border_yet){
			this.showInformationMessage('doing action: check_if_user_to_kernel_border_yet');
			let filepath:string = "";
			let lineNumber:number = -1;
			const userToKernelBorderFile = this.breakpointGroups.getCurrentBreakpointGroup().border?.filepath;
			const userToKernelBorderLine = this.breakpointGroups.getCurrentBreakpointGroup().border?.line;
			//todo if you are trying to do multi-core debugging, you might need to modify the 3rd argument.
			this.miDebugger.getStack(0, 1, this.recentStopThreadID).then(v=>{
				filepath = v[0].file;
				lineNumber = v[0].line;
				if (filepath === userToKernelBorderFile && lineNumber === userToKernelBorderLine){
					this.OSStateTransition(new OSEvent(OSEvents.AT_USER_TO_KERNEL_BORDER));
				}
			});

		}
		else if(action.type === DebuggerActions.start_consecutive_single_steps){
			this.showInformationMessage("doing action: start_consecutive_single_steps");
			// after this single step finished, `STOPPED` event will trigger next single step according to the state machine
			this.miDebugger.stepInstruction();
		}
		else if(action.type === DebuggerActions.try_get_next_breakpoint_group_name){
			this.showInformationMessage('doing action: try_get_next_breakpoint_group_name');
			let filepath:string = "";
			let lineNumber:number = -1;
			//todo if you are trying to do multi-core debugging, you might need to modify the 3rd argument.
			this.miDebugger.getStack(0, 1, this.recentStopThreadID).then(v=>{
				filepath = v[0].file;
				lineNumber = v[0].line;
				//if `behavior()` has not been executed, `this.breakpointGroups.nextBreakpointGroup` stays the same.
				for(const hook of this.breakpointGroups.getCurrentBreakpointGroup().hooks){
					//todo since hook.behavior is async, it is possible that os jump to border before the hook finished, causing nextbreakpointgroup not updated properly.
					//in this extreme case, use `this.currentHook`.
					this.currentHook = hook;
					this.showInformationMessage('hook is ' + hook.behavior);
					if (filepath === hook.breakpoint.file && lineNumber === hook.breakpoint.line){
						eval(hook.behavior)().then((hookResult:string)=>{
							this.breakpointGroups.setNextBreakpointGroup(hookResult);
							this.currentHook = undefined;
							this.showInformationMessage('finished action: try_get_next_breakpoint_group_name.\nNext breakpoint group is ' + hookResult);
						});
					}
				}
			});

		}
		else if(action.type === DebuggerActions.high_level_switch_breakpoint_group_to_low_level){//for example, user to kernel
			const high_level_breakpoint_group_name = this.breakpointGroups.getCurrentBreakpointGroupName();
			this.breakpointGroups.updateCurrentBreakpointGroup(this.breakpointGroups.getNextBreakpointGroup());
			this.breakpointGroups.setNextBreakpointGroup(high_level_breakpoint_group_name);// if a hook is triggered during low level execution, NextBreakpointGroup will be set to the return value of hook behavior function.
		}
		else if(action.type === DebuggerActions.low_level_switch_breakpoint_group_to_high_level){//for example, kernel to user
			const low_level_breakpoint_group_name = this.breakpointGroups.getCurrentBreakpointGroupName();
			const high_level_breakpoint_group_name = this.breakpointGroups.getNextBreakpointGroup();
			this.breakpointGroups.updateCurrentBreakpointGroup(high_level_breakpoint_group_name);
			this.breakpointGroups.setNextBreakpointGroup(low_level_breakpoint_group_name);
		}

	}

```

相比于旧版的没有状态机的代码里，这类 action 实现起来非常麻烦，例如`updateCurrentAddrAtStop`函数：

```ts
	/// update currentAddr, currentPrivilegeLevel, privilegeLevelJustChanged
	public updateCurrentAddrAtStop(info:MINode) {
		this.currentAddr = Number(getAddrFromMINode(info));
		let newCurrentPrivilegeLevel = this.addr2privilege(this.currentAddr);

		if (newCurrentPrivilegeLevel !== this.currentPrivilegeLevel){
			this.privilegeLevelJustChanged=true;
		}else{
			this.privilegeLevelJustChanged=false;
		}
		this.currentPrivilegeLevel = newCurrentPrivilegeLevel;
	}
```
需要同时更新`currentAddr, currentPrivilegeLevel,privilegeLevelJustChanged`。这样的代码非常难维护。

在构造了状态机`OSStateMachine`和状态机的转换方法`OSStateTransition`之后，我们不再需要手动更新特权级和“特权级改变过”的 flag 了。我们只需要获取 PC 寄存器，判断它的区间，如果是所需区间，激活“到达 xx 特权级”的事件即可。

过去是在断点触发的时候判断这个断点是不是边界，现在由于状态机的表述方式不同，改为需要判断“我在哪里”时，发送一个单独的 GDB 命令来获得这个信息。在 google 上找到 gdb 命令（`where`），查找文档得到对应的 MI 命令（`-stack-list-frames`），查找代码发现插件已经有了一个得封装很好的实现了（`getStack`），因此不需要像之前那样用硬编码的方式从 MINode 里获取数据了。

这个`stack`的`stack frame`指的是函数的调用栈，和页帧无关。我们只要取最上一层的 frame 0 即可。
```ts
		else if(action.type === DebuggerActions.check_if_kernel_to_user_border_yet){
			this.showInformationMessage('doing action: check_if_kernel_to_user_border_yet');
			let filepath:string = "";
			let lineNumber:number = -1;
			const kernelToUserBorderFile = this.breakpointGroups.getCurrentBreakpointGroup().border?.filepath;
			const kernelToUserBorderLine = this.breakpointGroups.getCurrentBreakpointGroup().border?.line;
			//todo if you are trying to do multi-core debugging, you might need to modify the 3rd argument.
			this.miDebugger.getStack(0, 1, this.recentStopThreadID).then(v=>{
				filepath = v[0].file;
				lineNumber = v[0].line;
				if (filepath === kernelToUserBorderFile && lineNumber === kernelToUserBorderLine){
					this.OSStateTransition(new OSEvent(OSEvents.AT_KERNEL_TO_USER_BORDER));
				}
			});
		}
```
由于执行环境的隔离性，底层可以知道接下来要去哪个顶层的断点组，但是反过来不行。我们的解决办法是：**底层转到高层时，就预先假设高层会回到这个底层。在高层运行期间不去获取接下来要回到哪个底层，因为根本获取不到**。

所以，`switch_breakpoint_group` 变为 `high_level_switch_breakpoint_group_to_low_level` 和
`low_level_switch_breakpoint_group_to_high_level`。

内核转换到用户态时用`low_level_switch_breakpoint_group_to_high_level`，包含了指定`nextbreakpointgroup`为内核的行为；而用户态切换回内核时用的`high_level_switch_breakpoint_group_to_low_level`则没有：

```ts
		else if(action.type === DebuggerActions.high_level_switch_breakpoint_group_to_low_level){//for example, user to kernel
			const high_level_breakpoint_group_name = this.breakpointGroups.getCurrentBreakpointGroupName();
			this.breakpointGroups.updateCurrentBreakpointGroup(this.breakpointGroups.getNextBreakpointGroup());
			this.breakpointGroups.setNextBreakpointGroup(high_level_breakpoint_group_name);// if a hook is triggered during low level execution, NextBreakpointGroup will be set to the return value of hook behavior function.
		}
```

内核转换到用户态时用`low_level_switch_breakpoint_group_to_high_level`，而用户态切换回内核时用`high_level_switch_breakpoint_group_to_low_level`：

```ts
export const OSStateMachine: OSStateMachine = {
	initial: OSStates.kernel,
	states: {
		[OSStates.kernel]: {
			on: {
				[OSEvents.STOPPED]: {
					target: OSStates.kernel,
					actions: [
						{ type: DebuggerActions.try_get_next_breakpoint_group_name }, //if got, save it to a variable. if not, stay the same. initial is "initproc"
						{ type: DebuggerActions.check_if_kernel_to_user_border_yet }, //if yes, event `AT_KERNEL_TO_USER_BORDER` happens
					],
				},
				[OSEvents.AT_KERNEL_TO_USER_BORDER]: {
					target: OSStates.kernel_single_step_to_user,
					actions: [{ type: DebuggerActions.start_consecutive_single_steps }],
				},
			},
		},
		[OSStates.kernel_single_step_to_user]: {
			on: {
				[OSEvents.STOPPED]: {
					target: OSStates.kernel_single_step_to_user,
					actions: [
						{ type: DebuggerActions.check_if_user_yet }, //if yes, event `AT_USER` happens. if no, keep single stepping
					],
				},
				[OSEvents.AT_USER]: {
					target: OSStates.user,
					actions: [
						// border breakpoint is included in breakpoint group.
						// also switch debug symbol file
						// after breakpoint group changed, set the next breakpoint group to the kernel's breakpoint group.
						{ type: DebuggerActions.low_level_switch_breakpoint_group_to_high_level },
					],
				},
			},
		},
		[OSStates.user]: {
			on: {
				[OSEvents.STOPPED]: {
					target: OSStates.user,
					actions: [
						{ type: DebuggerActions.check_if_user_to_kernel_border_yet }, //if yes, event `AT_USER_TO_KERNEL_BORDER` happens
					],
				},
				[OSEvents.AT_USER_TO_KERNEL_BORDER]: {
					target: OSStates.user_single_step_to_kernel,
					actions: [
						{ type: DebuggerActions.start_consecutive_single_steps }, // no need to `get_next_breakpoint_group_name` because the breakpoint group is already set when kernel changed to user breakpoint group
					],
				},
			},
		},
		[OSStates.user_single_step_to_kernel]: {
			on: {
				[OSEvents.STOPPED]: {
					target: OSStates.user_single_step_to_kernel,
					actions: [
						{ type: DebuggerActions.check_if_kernel_yet }, //if yes, event `AT_KERNEL` happens. if no, keep single stepping
					],
				},
				[OSEvents.AT_KERNEL]: {
					target: OSStates.kernel,
					actions: [
						{ type: DebuggerActions.high_level_switch_breakpoint_group_to_low_level }, // including the border breakpoint
					],
				},
			},
		},
	},
};
```
由于状态机比较简陋，这种实现还是有不完美的地方：
1. 一些行为没有放到状态机里面（但是全部都在`doAction`方法里）
2. 依赖`recentStopThreadID`. 这个数据是在状态机之外的`StopEvent`方法里更新的。  
后续可以继续改进

#### 单步步进
这次更新后实现了之前没有的单步步进的功能，包括逐步执行、单条指令级别的调试以及跳出当前函数的调试操作。通过这些方法，实现逐步分析和理解代码的执行过程，从而更快地定位和解决问题。

```ts
step(reverse: boolean = false): Thenable<boolean> {
		if (trace) this.log("stderr", "step");
		return new Promise((resolve, reject) => {
			this.sendCommand("exec-step" + (reverse ? " --reverse" : "")).then((info) => {
				resolve(info.resultRecords.resultClass == "running");
			}, reject);
		});
	}

	stepInstruction(reverse: boolean = false): Thenable<boolean> {
		if (trace) this.log("stderr", "stepInstruction");
		return new Promise((resolve, reject) => {
			this.sendCommand("exec-step-instruction" + (reverse ? " --reverse" : "")).then((info) => {
				resolve(info.resultRecords.resultClass == "running");
			}, reject);
		});
	}

	stepOut(reverse: boolean = false): Thenable<boolean> {
		if (trace) this.log("stderr", "stepOut");
		return new Promise((resolve, reject) => {
			this.sendCommand("exec-finish" + (reverse ? " --reverse" : "")).then((info) => {
				resolve(info.resultRecords.resultClass == "running");
			}, reject);
		});
	}
```

#### 符号表文件的切换
符号表文件和断点组在 rCore-Tutorial-v3 里是一对一的
，但是其他 OS 就不能保证了。而且，rCore-Tutorial-v3 的内核和用户符号表有时可以共存，有时不行，不知道在其他 OS 上是什么样子。因此符号表文件随着断点组切换而切换的逻辑作为用户提交代码。之前的做法是 添加新符号表-移除旧断点-打新断点 根本没有去除符号表。之前内核的符号表是不删去的。  这样其实不完善。   
由于断点是依赖符号表的，合理的顺序应该是 移除旧断点-移除旧符号表-添加新符号表-添加新断点。如果是这个顺序的话，符号表切换的逻辑就得放在 断点组切换 的函数里面，不能单列一个函数了。因此我们不能把整个符号表切换的逻辑抽离出来作为用户自定义代码。我们只能将 断点组=>符号表文件路径 的映射作为自定义代码。

之前 addDebugSymbol 和 removeDebugSymbol 是直接在 mibase.ts 里调用 sendCliCommand，这次放到 mi2.ts 里：

```ts
	addSymbolFile(filepath:string): Thenable<any> {
		if (trace) this.log("stderr", "addSymbolFile");
		return new Promise((resolve, reject) => {
			const promises: Thenable<void | MINode>[] = [];
			promises.push(
				this.sendCliCommand("add-symbol-file " + filepath).then((result) => {
					if (result.resultRecords.resultClass == "done") resolve(true);
					else resolve(false);
				})
			);
			Promise.all(promises).then(resolve, reject);
		});
	}

	removeSymbolFile(filepath:string): Thenable<any> {
		if (trace) this.log("stderr", "removeSymbolFile");
		return new Promise((resolve, reject) => {
			const promises: Thenable<void | MINode>[] = [];
			promises.push(
				this.sendCliCommand("remove-symbol-file " + filepath).then((result) => {
					if (result.resultRecords.resultClass == "done") resolve(true);
					else resolve(false);
				})
			);
			Promise.all(promises).then(resolve, reject);
		});
	}


```

断点组切换时，符号表也切换：

```ts
	//缓存旧空间的断点，令GDB清除旧断点组的断点，卸载旧断点组的符号表文件，加载新断点组的符号表文件，加载新断点组的断点
	public updateCurrentBreakpointGroup(updateTo: string) {
		let newIndex = -1;
		for (let i = 0; i < this.groups.length; i++) {
			if (this.groups[i].name === updateTo) {
				newIndex = i;
			}
		}
		if (newIndex === -1) {
			this.groups.push(new BreakpointGroup(updateTo, [], new HookBreakpoints([]), undefined));
			newIndex = this.groups.length - 1;
		}
		let oldIndex = -1;
		for (let j = 0; j < this.groups.length; j++) {
			if (this.groups[j].name === this.getCurrentBreakpointGroupName()) {
				oldIndex = j;
			}
		}
		if (oldIndex === -1) {
			this.groups.push(new BreakpointGroup(this.getCurrentBreakpointGroupName(), [], new HookBreakpoints([]), undefined));
			oldIndex = this.groups.length - 1;
		}
		this.groups[oldIndex].setBreakpointsArguments.forEach((e) => {
			this.debugSession.miDebugger.clearBreakPoints(e.source.path);
		});

		this.debugSession.miDebugger.removeSymbolFile(eval(this.debugSession.breakpointGroupNameToDebugFilePath)(this.getCurrentBreakpointGroupName()));

		this.debugSession.miDebugger.addSymbolFile(eval(this.debugSession.breakpointGroupNameToDebugFilePath)(this.groups[newIndex].name));

		this.groups[newIndex].setBreakpointsArguments.forEach((args) => {
			this.debugSession.miDebugger.clearBreakPoints(args.source.path).then(
				() => {
					let path = args.source.path;
					if (this.debugSession.isSSH) {
						// convert local path to ssh path
						path = this.debugSession.sourceFileMap.toRemotePath(path);
					}
					const all = args.breakpoints.map((brk) => {
						return this.debugSession.miDebugger.addBreakPoint({
							file: path,
							line: brk.line,
							condition: brk.condition,
							countCondition: brk.hitCondition,
						});
					});
				},
				(msg) => {
					//TODO
				}
			);
		});
		this.currentBreakpointGroupName = this.groups[newIndex].name;
		this.debugSession.showInformationMessage("breakpoint group changed to " + updateTo);
	}
	//there should NOT be an `setCurrentBreakpointGroupName()` func because changing currentGroupName also need to change breakpoint group itself, which is what `updateCurrentBreakpointGroup()` does.
	public getCurrentBreakpointGroupName():string {
		return this.currentBreakpointGroupName;
	}
	// notice it can return undefined
	public getBreakpointGroupByName(groupName:string){
		for (const k of this.groups){
			if (k.name === groupName){
				return k;
			}
		}
		return;
	}
	// notice it can return undefined
	public getCurrentBreakpointGroup():BreakpointGroup{
		const groupName = this.getCurrentBreakpointGroupName();
		for (const k of this.groups){
			if (k.name === groupName){
				return k;
			}
		}
		return;
	}
	public getNextBreakpointGroup(){
		return this.nextBreakpointGroup;
	}
	public setNextBreakpointGroup(groupName:string){
		this.nextBreakpointGroup = groupName;
	}
	public getAllBreakpointGroups():readonly BreakpointGroup[]{
		return this.groups;
	}
	// save breakpoint information into a breakpoint group, but NOT let GDB set those breakpoints yet
	public saveBreakpointsToBreakpointGroup(args: DebugProtocol.SetBreakpointsArguments, groupName: string) {
		let found = -1;
		for (let i = 0; i < this.groups.length; i++) {
			if (this.groups[i].name === groupName) {
				found = i;
			}
		}
		if (found === -1) {
			this.groups.push(new BreakpointGroup(groupName, [], new HookBreakpoints([]), undefined));
			found = this.groups.length - 1;
		}
		let alreadyThere = -1;
		for (let i = 0; i < this.groups[found].setBreakpointsArguments.length; i++) {
			if (this.groups[found].setBreakpointsArguments[i].source.path === args.source.path) {
				this.groups[found].setBreakpointsArguments[i] = args;
				alreadyThere = i;
			}
		}
		if (alreadyThere === -1) {
			this.groups[found].setBreakpointsArguments.push(args);
		}
	}

```

#### 文件路径

在实现`filePathToBreakpointGroupNames`和`breakpointGroupNameToDebugFilePath`的时候，我们发现`filePathToBreakpointGroupNames`在使用后是需要做失败处理的，因为用户态程序运行到用户库的时候，由于所有应用程序都共享同一份用户库代码，**这种情况下，一个断点会同时属于多个断点组**。比如
rCore-Tutorial-v3 里 user/src/syscall.rs 里的断点就属于所有用户态程序的断点组。

`breakpointGroupNameToDebugFilePath`不会有这个问题。

`filePathToBreakpointGroupNames`函数：

```ts
"filePathToBreakpointGroupNames": {
								"type": "object",
								"description": "user-submitted js code used to turn a filepath into breakpoint group name",
								"default": {
									"isAsync": false,
									"functionArguments": "filePathStr",
									"functionBody": "     if (filePathStr.includes('os/src')) {        return ['kernel'];    }    else if (filePathStr.includes('user/src/bin')) {        return [filePathStr];    }    else if (!filePathStr.includes('user/src/bin') && filePathStr.includes('user/src')) {        return ['${workspaceFolder}/user/src/bin/adder_atomic.rs', '${workspaceFolder}/user/src/bin/adder_mutex_blocking.rs', '${workspaceFolder}/user/src/bin/adder_mutex_spin.rs', '${workspaceFolder}/user/src/bin/adder_peterson_spin.rs', '${workspaceFolder}/user/src/bin/adder_peterson_yield.rs', '${workspaceFolder}/user/src/bin/adder.rs', '${workspaceFolder}/user/src/bin/adder_simple_spin.rs', '${workspaceFolder}/user/src/bin/adder_simple_yield.rs', '${workspaceFolder}/user/src/bin/barrier_condvar.rs', '${workspaceFolder}/user/src/bin/barrier_fail.rs', '${workspaceFolder}/user/src/bin/cat.rs', '${workspaceFolder}/user/src/bin/cmdline_args.rs', '${workspaceFolder}/user/src/bin/condsync_condvar.rs', '${workspaceFolder}/user/src/bin/condsync_sem.rs', '${workspaceFolder}/user/src/bin/count_lines.rs', '${workspaceFolder}/user/src/bin/eisenberg.rs', '${workspaceFolder}/user/src/bin/exit.rs', '${workspaceFolder}/user/src/bin/fantastic_text.rs', '${workspaceFolder}/user/src/bin/filetest_simple.rs', '${workspaceFolder}/user/src/bin/forktest2.rs', '${workspaceFolder}/user/src/bin/forktest.rs', '${workspaceFolder}/user/src/bin/forktest_simple.rs', '${workspaceFolder}/user/src/bin/forktree.rs', '${workspaceFolder}/user/src/bin/gui_rect.rs', '${workspaceFolder}/user/src/bin/gui_simple.rs', '${workspaceFolder}/user/src/bin/gui_snake.rs', '${workspaceFolder}/user/src/bin/gui_uart.rs', '${workspaceFolder}/user/src/bin/hello_world.rs', '${workspaceFolder}/user/src/bin/huge_write_mt.rs', '${workspaceFolder}/user/src/bin/huge_write.rs', '${workspaceFolder}/user/src/bin/infloop.rs', '${workspaceFolder}/user/src/bin/initproc.rs', '${workspaceFolder}/user/src/bin/inputdev_event.rs', '${workspaceFolder}/user/src/bin/matrix.rs', '${workspaceFolder}/user/src/bin/mpsc_sem.rs', '${workspaceFolder}/user/src/bin/peterson.rs', '${workspaceFolder}/user/src/bin/phil_din_mutex.rs', '${workspaceFolder}/user/src/bin/pipe_large_test.rs', '${workspaceFolder}/user/src/bin/pipetest.rs', '${workspaceFolder}/user/src/bin/priv_csr.rs', '${workspaceFolder}/user/src/bin/priv_inst.rs', '${workspaceFolder}/user/src/bin/race_adder_arg.rs', '${workspaceFolder}/user/src/bin/random_num.rs', '${workspaceFolder}/user/src/bin/run_pipe_test.rs', '${workspaceFolder}/user/src/bin/sleep.rs', '${workspaceFolder}/user/src/bin/sleep_simple.rs', '${workspaceFolder}/user/src/bin/stackful_coroutine.rs', '${workspaceFolder}/user/src/bin/stackless_coroutine.rs', '${workspaceFolder}/user/src/bin/stack_overflow.rs', '${workspaceFolder}/user/src/bin/store_fault.rs', '${workspaceFolder}/user/src/bin/sync_sem.rs', '${workspaceFolder}/user/src/bin/tcp_simplehttp.rs', '${workspaceFolder}/user/src/bin/threads_arg.rs', '${workspaceFolder}/user/src/bin/threads.rs', '${workspaceFolder}/user/src/bin/udp.rs', '${workspaceFolder}/user/src/bin/until_timeout.rs', '${workspaceFolder}/user/src/bin/user_shell.rs', '${workspaceFolder}/user/src/bin/usertests.rs', '${workspaceFolder}/user/src/bin/yield.rs'];    }    else        return ['kernel'];"
								}
							},
							
```

注意，如果确实找不到断点空间（比如一些在 GDB 里面开头是/rust 的库文件），就把它归为内核的断点。把用到`filePathToSpaceNames`的地方都改成能够处理一个断点对应多个断点组的情况了。如果删除这种“一对多”的断点的话也不用担心，因为并不存在删除断点的动作，而是 args 参数传来那个文件对应的所有断点，然后那一个文件对应的所有断点都被清掉，全部重新设置一遍。断点组管理模块也是这样的。

```ts
	/// 用于设置某一个文件的所有断点
	protected override setBreakPointsRequest(response: DebugProtocol.SetBreakpointsResponse, args: DebugProtocol.SetBreakpointsArguments): void {
		// the path is supposed to be FULL PATH like /home/czy/project/file.c
		let path = args.source.path;
		if (this.isSSH) {
			// convert local path to ssh path
			path = this.sourceFileMap.toRemotePath(path);
		}
		//先清空该文件内的断点，再重新设置所有断点
		this.miDebugger.clearBreakPoints(path).then(() => {
			let spaceNames:string[] = this.filePathToSpaceNames(path);
			let currentSpaceName = this.addressSpaces.getCurrentSpaceName();
			//保存这些断点信息到断点所属的断点组（可能不止一个）里
			for(let spaceName in spaceNames){
				this.addressSpaces.saveBreakpointsToSpace(args, spaceName);
			}
			//注意，此时断点组管理模块里已经有完整的断点相关的信息了

			let flag = false;
			for(let spaceName in spaceNames){
				if(spaceName===currentSpaceName) { flag = true; }
			}
			//如果这些断点所属的断点组和当前断点组没有交集，比如还在内核态时就设置用户态的断点，就结束函数，不通知GDB设置断点
			if(flag===true) return;

			//反之，如果这些断点所属的断点组中有一个就是当前断点组，那么就通知GDB立即设置断点
			const all = args.breakpoints.map(brk => {
				return this.miDebugger.addBreakPoint({ file: path, line: brk.line, condition: brk.condition, countCondition: brk.hitCondition });
			});
			//令GDB设置断点
			Promise.all(all).then(brkpoints => {
				const finalBrks: DebugProtocol.Breakpoint[] = [];
				brkpoints.forEach(brkp => {
					// TODO: Currently all breakpoints returned are marked as verified,
					// which leads to verified breakpoints on a broken lldb.
					if (brkp[0])
						finalBrks.push(new DebugAdapter.Breakpoint(true, brkp[1].line));
						});
						response.body = {
							breakpoints: finalBrks,
						};
						this.sendResponse(response);
					},
					(msg) => {
						this.sendErrorResponse(response, 9, msg.toString());
					}
				);
			},
			(msg) => {
				this.sendErrorResponse(response, 9, msg.toString());
			}
		);
	}

```

<span id="完善4"></span>
### 4. 添加 showInformationMessage 函数，代替 mibase.ts 中无法使用的 console.log
使用 sendEvent() 方法将构造的事件对象发送给调试客户端，以展示信息提示给用户。

	```
    public showInformationMessage(info:string){
		this.sendEvent({
			event: "showInformationMessage",
			body: info,
		} as DebugProtocol.Event);

	}
    ```

<span id="完善5"></span>
### 5. 有的情况continue不能跳转到断点

+ 之前在内核出口边界设用户态程序开头位置的断点，然后直接 continue 就可以跳转到这个断点。这是因为
  rCore-Tutorial-v3 用了跳板页（详见<https://scpointer.github.io/rcore2oscomp/docs/lab2/gdb.html>）
  。在没有跳板页，且是双页表的 OS 的情况下，这个策略不会起作用。

由于今年新实现了单步步进功能，我们可以通过不断的自动的单步（step instruction）每单步一次就查看内存地址来确定是否到达新的特权级。

<span id="新的工作"></span>
## 新的工作：
<span id="新1"></span>
### 1. 增加通过SSH进行OS调试的功能  
我们为了进一步实现通过SSH进行远程操作系统调试的功能，通过以下步骤来集成SSH功能：

首先，初始化调试会话，`initializeRequest` 方法设置了调试会话支持的各种功能，例如支持条件断点、函数断点、内存读写等。这些功能通过修改 `response.body` 的不同属性来指定。接着，用`launchRequest` 方法启动调试。然后，使用提供的GDB路径和其他参数（如调试器参数和环境变量）创建 `MI2` 类的实例。根据 `args.pathSubstitutions` 设置源文件的路径替换规则以便调试器可以正确地定位到原始源文件。配置好调试会话后，就开始处理ssh配置。如果提供了SSH参数 (`args.ssh`)，则进入SSH配置分支：

相关代码实现如下：

```typescript
protected override launchRequest(response: DebugProtocol.LaunchResponse, args: LaunchRequestArguments): void {
    // 使用提供的 gdbpath 或默认的 "gdb" 作为调试器命令
    const dbgCommand = args.gdbpath || "gdb";

    if (this.checkCommand(dbgCommand)) {
        // 如果调试器命令无效，发送错误响应并终止
        this.sendErrorResponse(response, 104, `Configured debugger ${dbgCommand} not found.`);
        return;
    }

    // 创建 MI2 实例，它是与 GDB 交互的接口
    this.miDebugger = new MI2(
        dbgCommand, 
        ["-q", "--interpreter=mi2"], 
        args.debugger_args, 
        args.env
    );

    // 设置源文件路径替换规则
    this.setPathSubstitutions(args.pathSubstitutions);

    // 初始化调试器
    this.initDebugger();

    // 设置调试会话的状态标志
    this.quit = false;
    this.attached = false;
    this.initialRunCommand = RunCommand.RUN;
    this.isSSH = false;
    this.started = false;
    this.crashed = false;

    this.setValuesFormattingMode(args.valuesFormatting);

    this.miDebugger.printCalls = !!args.printCalls;
    this.miDebugger.debugOutput = !!args.showDevDebugOutput;

    this.stopAtEntry = args.stopAtEntry;

    // 处理 SSH 配置，如果提供了 SSH 参数
    if (args.ssh !== undefined) {
        // 设置默认的 SSH 参数值，如端口、X11端口等
        if (args.ssh.forwardX11 === undefined)
            args.ssh.forwardX11 = true;
        if (args.ssh.port === undefined)
            args.ssh.port = 22;
        if (args.ssh.x11port === undefined)
            args.ssh.x11port = 6000;
        if (args.ssh.x11host === undefined)
            args.ssh.x11host = "localhost";
        if (args.ssh.remotex11screen === undefined)
            args.ssh.remotex11screen = 0;

        // 标记为 SSH 调试会话
        this.isSSH = true;

        // 设置源文件映射
        this.setSourceFileMap(args.ssh.sourceFileMap, args.ssh.cwd, args.cwd);

        // 通过 SSH 连接到远程主机并启动 GDB
        this.miDebugger.ssh(args.ssh, args.ssh.cwd, args.target, args.arguments, args.terminal, false, args.autorun || []).then(() => {
            // 如果 SSH 成功，发送成功的响应
            this.sendResponse(response);
        }, err => {
            // 如果 SSH 失败，发送错误响应
            this.sendErrorResponse(response, 105, `Failed to SSH: ${err.toString()}`);
        });
    } else {
        // 如果没有提供 SSH 参数，表示在本地启动 GDB
        this.miDebugger.load(args.cwd, args.target, args.arguments, args.terminal, args.autorun || []).then(() => {
            this.sendResponse(response);
        }, err => {
            this.sendErrorResponse(response, 103, `Failed to load MI Debugger: ${err.toString()}`);
        });
    }
}
```
在上述代码中，我们首先检查是否提供了SSH参数。如果提供了，我们将这些参数用于设置SSH连接，包括端口和X11端口等。然后，我们设置一个标志`this.isSSH`来表明我们正在使用SSH。之后，我们设置了源文件映射，这有助于在调试过程中正确地映射和识别文件路径。最关键的是调用`this.miDebugger.ssh`方法，它负责根据提供的参数启动SSH连接，并在远程主机上运行GDB。如果SSH连接成功建立，我们将发送一个成功的响应；如果失败，则发送一个错误响应。通过这种方式，开发者可以在本地机器上使用VS Code进行远程调试，就像在本地机器上调试一样方便。

以下代码是 `ssh` 的方法的具体实现，这个方法的目的是建立一个 SSH 连接到远程主机，并在远程主机上执行一系列命令，通常用于启动和控制远程调试会话。

```typescript

// 定义一个 ssh 方法，用于通过 SSH 连接到远程主机并执行命令。
ssh(args: SSHArguments, cwd: string, target: string, procArgs: string, separateConsole: string, attach: boolean, autorun: string[]): Thenable<any> {
    return new Promise((resolve, reject) => {
        // 标记已通过 SSH 连接。
        this.isSSH = true;
        // 初始 SSH 连接状态为未就绪。
        this.sshReady = false;
        // 创建一个新的 SSH 客户端实例。
        this.sshConn = new Client();

        // 如果提供了单独的控制台参数，发出警告，因为 SSH 不支持终端模拟器的输出。
        if (separateConsole !== undefined)
            this.log("stderr", "WARNING: Output to terminal emulators are not supported over SSH");

        // 如果需要 X11 转发，设置相关事件处理。
        if (args.forwardX11) {
            this.sshConn.on("x11", (info, accept, reject) => {
                const xserversock = new net.Socket();
                // 处理本地 X11 服务器连接错误。
                xserversock.on("error", (err) => {
                    this.log("stderr", "Could not connect to local X11 server! Did you enable it in your display manager?\n" + err);
                });
                // 处理成功连接到本地 X11 服务器的事件。
                xserversock.on("connect", () => {
                    const xclientsock = accept();
                    // 创建 X11 转发数据的管道。
                    xclientsock.pipe(xserversock).pipe(xclientsock);
                });
                // 连接到指定的本地 X11 端口和主机。
                xserversock.connect(args.x11port, args.x11host);
            });
        }

        // 设置 SSH 连接参数，包括主机、端口和用户名。
        const connectionArgs: any = {
            host: args.host,
            port: args.port,
            username: args.user
        };

        // 根据认证方式设置连接参数，使用密钥或密码。
        if (args.useAgent) {
            // 如果使用 SSH 代理，设置环境变量中的 SSH 认证套接字。
            connectionArgs.agent = process.env.SSH_AUTH_SOCK;
        } else if (args.keyfile) {
            // 如果使用私钥文件，检查文件是否存在并读取内容。
            if (fs.existsSync(args.keyfile))
                connectionArgs.privateKey = fs.readFileSync(args.keyfile);
            else {
                // 如果私钥文件不存在，记录错误并拒绝 Promise。
                this.log("stderr", "SSH key file does not exist!");
                this.emit("quit");
                reject();
                return;
            }
        } else {
            // 如果不使用密钥文件，则使用密码认证。
            connectionArgs.password = args.password;
        }

        // 当 SSH 客户端准备就绪时，执行回调函数。
        this.sshConn.on("ready", () => {
            // 记录正在通过 SSH 运行的应用程序。
            this.log("stdout", "Running " + this.application + " over ssh...");
            // 设置执行命令时的参数，如 X11 转发参数。
            const execArgs: ExecOptions = {};
            if (args.forwardX11) {
                execArgs.x11 = {
                    single: false,
                    screen: args.remotex11screen
                };
            }
            // 构造要通过 SSH 执行的命令。
            let sshCMD = this.application + " " + this.preargs.concat(this.extraargs || []).join(" ");
            if (args.bootstrap) sshCMD = args.bootstrap + " && " + sshCMD;
            // 执行命令，并处理结果。
            this.sshConn.exec(sshCMD, execArgs, (err, stream) => {
                if (err) {
                    // 如果执行命令时出错，记录错误并拒绝 Promise。
                    this.log("stderr", "Could not run " + this.application + "(" + sshCMD + ") over ssh!");
                    if (err === undefined) {
                        err = new Error("<reason unknown>");
                    }
                    this.log("stderr", err.toString());
                    this.emit("quit");
                    reject();
                    return;
                }
                // 如果命令执行成功，设置 SSH 连接为就绪状态。
                this.sshReady = true;
                // 保存执行命令的流，以便后续操作。
                this.stream = stream;
                // 设置数据和错误输出的处理函数。
                stream.on("data", this.stdout.bind(this));
                stream.stderr.on("data", this.stderr.bind(this));
                // 设置命令执行退出的处理函数。
                stream.on("exit", () => {
                    this.emit("quit");
                    this.sshConn.end();
                });
                // 发送初始化命令，如更改工作目录。
                const promises = this.initCommands(target, cwd, attach);
                promises.push(this.sendCommand("environment-cd \"" + escape(cwd) + "\""));
                // 如果需要附加到进程，发送相应的命令。
                if (attach) {
                    promises.push(this.sendCommand("target-attach " + target));
                } else if (procArgs && procArgs.length)
                    promises.push(this.sendCommand("exec-arguments " + procArgs));
                // 发送自动运行命令。
                promises.push(...autorun.map(value => { return this.sendUserInput(value); }));
                // 等待所有初始化命令完成。
                Promise.all(promises).then(() => {
                    this.emit("debug-ready");
                    resolve(undefined);
                }, reject);
            });
        }).on("error", (err) => {
            // 如果 SSH 连接出错，记录错误并拒绝 Promise。
            this.log("stderr", "Error running " + this.application + " over ssh!");
            if (err === undefined) {
                err = new Error("<reason unknown>");
            }
            this.log("stderr", err.toString());
            this.emit("quit");
            reject();
        }).connect(connectionArgs);
    });
}

```
以上所用到的SSH 配置是通过 args 参数传递给 ssh 方法的，args 是一个 SSHArguments 类型的对象，包含了建立 SSH 连接所需的所有参数和配置（在`backend.ts`文件中）。

<span id="新2"></span>
###  2. 提升 Debug Console 输出内容的可读性

我们在mi2.ts中定义了多个处理函数，用于接收和处理来自调试器（如 GDB）的标准输出（stdout）和标准错误（stderr）。
- `stdout` 和 `stderr` 函数将接收到的数据追加到 `buffer` 和 `errbuf` 字符串中。这允许函数按行处理输出，而不是字符一个接一个地处理。
- 当缓冲区中的字符串遇到换行符（`\n`）时，将其按行分割并逐行处理。
- `onOutput` 和 `onOutputStderr` 函数分别处理标准输出和标准错误，这允许对不同类型的输出进行定制化处理。
- `onOutput` 函数检查每一行输出，判断它是否可能是调试器的输出（使用 `couldBeOutput` 函数）。对于调试器的输出，尝试解析为机器可读的格式（使用 `parseMI` 函数）。
- 使用 `log` 和 `logNoNewLine` 函数将信息记录到控制台。`log` 函数在记录信息时会在末尾添加换行符，而 `logNoNewLine` 则不会。
- 如果解析后的输出包含错误记录（`parsed.resultRecords.resultClass == "error"`），则将错误信息记录到标准错误输出。
- `onOutput` 函数还处理异步事件（如程序停止、断点命中等）。这些事件被转换为相应的动作，如发出自定义事件。
- 如果启用了调试输出（`this.debugOutput` 为 `true`），则将解析后的调试信息以美化的 JSON 格式输出到控制台。
- `onOutputPartial` 函数处理那些可能不完整的输出行，这有助于提升输出的实时性和可读性。
- 对于没有 token 的 MI 节点，使用 `originallyNoTokenMINodes` 数组来存储，并在达到一定数量时进行裁剪，这有助于管理内存并防止潜在的内存泄漏。
- 对于特定的停止原因（如断点命中、信号接收等），提供清晰的控制台消息，这有助于开发者快速理解程序的状态。
- 使用 `emit` 函数发出自定义事件，这允许其他监听器响应这些事件并采取行动，如更新 UI 或状态指示器。

相关代码实现如下

```typescript
onOutput(str: string) {
    // 将接收到的字符串按行分割
    const lines = str.split('\n');
    
    // 遍历每一行
    lines.forEach(line => {
        // 判断当前行是否可能是调试器的输出
        if (couldBeOutput(line)) {
            // 如果当前行不是通过 gdbMatch 正则表达式匹配的特定格式，则记录为标准输出
            if (!gdbMatch.exec(line)) this.log("stdout", line);
        } else {
            // 解析当前行为 GDB 机器接口（MI）格式
            const parsed = parseMI(line);
            console.log("parsed:" + JSON.stringify(parsed));
            
            let handled = false; // 标记当前行是否已经被处理
            // 如果解析结果包含 token
            if(parsed.token !== undefined){
                // 如果存在对应的处理函数，则调用该函数并删除该 token 的记录
                if (this.handlers[parsed.token]) {
                    this.handlers[parsed.token](parsed);
                    delete this.handlers[parsed.token];
                    handled = true;
                }
                // 更新 token 计数器
                this.tokenCount = this.tokenCount + 1;
                // 更新 token 值
                parsed.token = this.tokenCount;
            }
            else{
                // 如果解析结果不包含 token，则分配一个 token
                parsed.token = this.tokenCount + 1;
                // 存储原始没有 token 的 MI 节点
                this.originallyNoTokenMINodes.push(parsed);
                // 如果存储的节点超过 100 个，则移除前面的 90 个
                if (this.originallyNoTokenMINodes.length >= 100) {
                    this.originallyNoTokenMINodes.splice(0, 90);
                    const rest = this.originallyNoTokenMINodes.splice(89);
                    this.originallyNoTokenMINodes = rest;
                }
            }
            // 如果启用了调试输出，则记录美化后的 JSON 输出和原始解析结果
            if (this.debugOutput) {
                this.log("stdout", "GDB -> App: " + prettyPrintJSON(parsed));
                console.log("onoutput:" + JSON.stringify(parsed));
            }
            // 如果解析结果包含错误记录，则记录为标准错误输出
            if (!handled && parsed.resultRecords && parsed.resultRecords.resultClass == "error") {
                this.log("stderr", parsed.result("msg") || line);
            }
            // 处理异步事件记录
            if (parsed.outOfBandRecord) {
                parsed.outOfBandRecord.forEach((record) => {
                    // 根据记录类型进行相应处理
                    if (record.isStream) {
                        this.log(record.type, record.content);
                    } else {
                        // 处理不同类型的异步事件
                        if (record.type == "exec") {
                            this.emit("exec-async-output", parsed);
                            // 发出不同的事件，表示程序正在运行或已停止
                            if (record.asyncClass == "running") this.emit("running", parsed);
                            else if (record.asyncClass == "stopped") {
                                // 根据停止原因发出不同的事件
                                const reason = parsed.record("reason");
                                // ...（处理不同的停止原因）
                            }
                        } else if (record.type == "notify") {
                            // 处理通知类型的异步事件
                            if (record.asyncClass == "thread-created") {
                                this.emit("thread-created", parsed);
                            } else if (record.asyncClass == "thread-exited") {
                                this.emit("thread-exited", parsed);
                            }
                        }
                    }
                });
                handled = true;
            }
            // 如果当前行没有被任何上述条件处理，则记录为未处理的输出
            if (!handled) this.log("log", "Unhandled: " + JSON.stringify(parsed));
        }
    });
}

```

通过这些方法，代码确保了调试控制台输出的可读性和有用性，使得开发者能够更容易地理解调试过程中发生的事情，这对于调试复杂的应用程序或在开发过程中解决问题至关重要。


- 测试、完善自动安装脚本
[自动安装脚本](https://github.com/chenzhiy2001/code-debug/blob/master/%E5%AE%89%E8%A3%85%E4%B8%8E%E4%BD%BF%E7%94%A8/test.sh)


- 提供帮助文档和帮助视频  

<span id="新3"></span>
### 3. 修改launch.json 文件
- 用户可以里提交自定义代码
- launch.json 支持${workspacefolder}插值（之前有一些参数是不能用这个插值的），大大提升了配置文件的便携性
[修改后的文件](https://github.com/chenzhiy2001/code-debug/blob/master/%E5%AE%89%E8%A3%85%E4%B8%8E%E4%BD%BF%E7%94%A8/ebpf_launch.json)

<span id="新4"></span>
### 4. 通过右键菜单添加/取消边界断点

+ 根据我们现在的状态机，边界断点应该包含在断点组里面，所以像之前那样发一个 customRequest，让 GDB 直接设断点（不经过 mibase.ts 的 setBreakPointsRequest，因此不会保存到断点组里面）就不合适了。
GoToKernel 等几个按钮的功能要么是不必要的，要么就是已经通过新的状态机自动化地实现了。
+ GDB 设断点会有一个断点偏移的问题。例如用户将断点设置在 12 行，GDB 可能会把断点改到 15 行进行设置。之前把边界断点信息都放在配置文件里面时，就需要反复尝试来找到断点不会偏移的行。如果改为用右键菜单设置边界断点，肯定是用户先设断点，断点偏移，然后用户再将偏移后的那个断点设为边界断点，不会出现上述问题。
+ 调试器的用户会反复改动 os 代码，因此边界断点的行号会一直改变。不仅要改配置文件还要考虑断点偏移，比较麻烦。如果开始 debug 再用鼠标点反而更自然。断点组机制的实现也会更自然。例如，每个用户程序的出口断点可能不一样（比如，一些是 rust 程序，一些是 C 的），用户可以选择刚开始 debug 的时候并不指定所有边界断点，而是运行到了用户态再添加用户断点。比静态的配置文件要好的多。

基于以上原因，我们移除了移除GoToKernel 等几个按钮，添加了一个右键菜单，用户在某个断点上面右键单击即可将这个断点变成边界断点。这样边界断点除了通过配置文件添加，也可以通过右键菜单添加或者取消。

<span id="新5"></span>
### 5. 修改插件本身的编译配置文件 tsconfig.json  
使得编译本插件的时候忽略文档文件夹和根文件夹下 60m 的“演示视频.mp4”，从而极大减小编译出的插件二进制包的大小
<span id="新6"></span>
### 6. 移植xv6
#### xv6-riscv

xv6-riscv 是一个小型的 Unix 第六版操作系统实现，包含了基本的操作系统功能，如进程管理、内存管理、文件系统、设备驱动和系统调用。
xv6-riscv 采用单内核结构，所有的操作系统服务都在内核模式下运行。内核代码包括内存管理、进程管理、文件系统、驱动程序和系统调用接口等部分。

#### 更新package.json
由于之前的调试器是仅rust语言可见的，我们修改了 package.json 文件，让它能够适配所有语言。
```
"menus": {
			"editor/title": [
				{
					"when": "resourceLangId == true",
					"command": "code-debug.removeAllCliBreakpoints",
					"group": "navigation"
				},
				{
					"when": "resourceLangId == true",
					"command": "code-debug.setBorderBreakpointsFromLaunchJSON",
					"group": "navigation"
				},
				{
					"when": "resourceLangId == true",
					"command": "code-debug.setHookBreakpointsFromLaunchJSON",
					"group": "navigation"
				},
				{
					"when": "resourceLangId == true",
					"command": "code-debug.disableCurrentSpaceBreakpoints",
					"group": "navigation"
				}
			],
        }
```

#### 编写launch.json

+ 配置文件需要找到qemu参数，xv6 内核态和用户态转换的边界，最后写出获取路径的函数。 
初步编写配置文件后发现只能从内核态转换到用户态，不能从用户态回到内核态，排查原因无果后我们决定**调试调试器**来进一步排查原因。
相关文档
Debugger Extension | Visual Studio Code Extension API
+ 调试器的构成及调试
code-debug插件分为两部分，扩展和调试适配器，这两部分是由两个进程来控制。所以如果调试的话应该是启动两个调试配置，一个是launch extension，另一个是server。
    + launch extension    
调试extension的部分，更具体地说是extension.ts文件，用它调试就会启动一个新窗口（扩展开发宿主）
    + server    
调试调试适配器的部分，即除了extension.ts文件的其他文件，这部分的调试需要进行一个配置（code-debug sever的调试配置），在code-debug中的launch.json已经配置好了，
里面有一个4711的端口号，启动这个配置以后，会监听这个端口号。
在我们要调试的项目中，添加一个``` "debugServer": 4711,```的配置，使两者可以传递信息。

+ 经过调试排查，我们发现不能从用户态回到内核态的原因是用户态的边界未被正确设置。
    + kernel/syscall.c是负责处理已经进到内核之后的syscall处理流程。我们需要的是用户态的syscall接口，在usys.S中。
    + 因为usys.S文件中有多个ecall，也就是说**用户态有多个边界断点**（因为xv6在用户态没有一个专门的syscall()处理函数，而是每个syscall的调用单独处理）。我们的调试器一开始是基于ebpf写的，所以用户和内核的边界都只有一个，接下来需要将边界改成数组，添加新的边界断点时旧的会被替换掉。所以需要**修改调试器的边界代码及相关处理函数**。   
  
```
export class Border  {
	filepath:string;
	line:number;
	constructor(filepath:string, line:number){
		this.filepath = filepath;
		this.line = line;
	}
}
class BreakpointGroup {
	name: string;
	setBreakpointsArguments: DebugProtocol.SetBreakpointsArguments[];
	borders?:Border[]; // can be a border or undefined
	hooks:HookBreakpoints; //cannot be `undefined`. It should at least an empty array `[]`.
	constructor(name: string, setBreakpointsArguments: DebugProtocol.SetBreakpointsArguments[], hooks:HookBreakpoints, borders?:Border[] ) {
		console.log(name);
		this.name = name;
		this.setBreakpointsArguments = setBreakpointsArguments;
		this.hooks = hooks;
		this.borders = borders;
	}
}
public updateBorder(border: Border) {
		const result = eval(this.debugSession.filePathToBreakpointGroupNames)(border.filepath);
		const groupNamesOfBorder:string[] = result;
		for(const groupNameOfBorder of groupNamesOfBorder){
			let groupExists = false;
			for(const group of this.groups){
				if(group.name === groupNameOfBorder){
					groupExists = true;
					group.borders.push(border);
				}
			}
			if(groupExists === false){
				this.groups.push(new BreakpointGroup(groupNameOfBorder, [], new HookBreakpoints([]), [border]));
			}
		}
	}
else if(action.type === DebuggerActions.check_if_kernel_to_user_border_yet){
			this.showInformationMessage('doing action: check_if_kernel_to_user_border_yet');
			let filepath:string = "";
			let lineNumber:number = -1;
			const kernelToUserBorders = this.breakpointGroups.getCurrentBreakpointGroup().borders; // 获取所有边界断点
			//const kernelToUserBorderFile = this.breakpointGroups.getCurrentBreakpointGroup().border?.filepath;
			//const kernelToUserBorderLine = this.breakpointGroups.getCurrentBreakpointGroup().border?.line;
			//todo if you are trying to do multi-core debugging, you might need to modify the 3rd argument.
			this.miDebugger.getStack(0, 1, this.recentStopThreadID).then(v=>{
				filepath = v[0].file;
				lineNumber = v[0].line;

				if (kernelToUserBorders) {
					for (const border of kernelToUserBorders) {
					 if (filepath === border.filepath && lineNumber === border.line) {
					 this.OSStateTransition(new OSEvent(OSEvents.AT_KERNEL_TO_USER_BORDER));
					 break;
					 }
					}
					 }
				 });
				
		}
		
		else if(action.type === DebuggerActions.check_if_user_to_kernel_border_yet){
			this.showInformationMessage('doing action: check_if_user_to_kernel_border_yet');
			let filepath:string = "";
			let lineNumber:number = -1;
			const userToKernelBorders = this.breakpointGroups.getCurrentBreakpointGroup().borders; 
			const userToKernelBorderFile = this.breakpointGroups.getCurrentBreakpointGroup().border?.filepath;
			const userToKernelBorderLine = this.breakpointGroups.getCurrentBreakpointGroup().border?.line;
			this.miDebugger.getStack(0, 1, this.recentStopThreadID).then(v=>{
				filepath = v[0].file;
				lineNumber = v[0].line;

				 if (userToKernelBorders) {
					for (const border of userToKernelBorders) {
					if (filepath === border.filepath && lineNumber === border.line) {
					 this.OSStateTransition(new OSEvent(OSEvents.AT_USER_TO_KERNEL_BORDER));
					 break;
				 }
				}
			 } 
			 });
			
		}
```
在launch.json里面只指定边界断点，没有指定边界断点所属的断点组。边界断点所属的断点组是由调试器自己去判定的。所以当触发了多个断点组中的一个，
调试器就会判定这个边界断点属于某某断点组，然后进行断点组切换的流程。


正确的配置文件如下：
```
{
    "version": "0.2.0",
    "configurations": [      
        {
            "type": "gdb",
            "request": "attach",
            "name": "Attach to Qemu",
            "autorun": ["add-symbol-file ${workspaceFolder}/kernel/kernel"],
            "target": ":1234",
            "remote": true,
            "cwd": "/home/kaining/xv6-riscv",
            "valuesFormatting": "parseText",
            "gdbpath": "${workspaceFolder}/riscv64-unknown-elf-gdb-rust.sh",
            "showDevDebugOutput":true,
            "internalConsoleOptions": "openOnSessionStart",
            "printCalls": true,
            "stopAtConnect": true,
            //"debugServer": 4711,
            "qemuPath": "qemu-system-riscv64",
            "qemuArgs": [
                "-machine", "virt", "-bios", "none",
                "-kernel", "${workspaceFolder}/kernel/kernel",
                "-m", "128M", "-smp", "2", "-nographic",
                "-global", "virtio-mmio.force-legacy=false",
                "-drive", "file=${workspaceFolder}/fs.img,if=none,format=raw,id=x0",
                "-device", "virtio-blk-device,drive=x0,bus=virtio-mmio-bus.0",
                
                "-s", "-S"
            ],
            "program_counter_id": 32,
            "first_breakpoint_group": "kernel",
            "second_breakpoint_group":"${workspaceFolder}/user/init.c",
            "kernel_memory_ranges":[["0x80000000","0xffffffffffffffff"]],
            "user_memory_ranges":[["0x0000000000000000","0x80000000"]],
            "border_breakpoints":[
                {
                    "filepath": "${workspaceFolder}/user/usys.S",
                    "line":6
                },
                {
                    "filepath": "${workspaceFolder}/user/usys.S",
                    "line":11
                },
                {
                    "filepath": "${workspaceFolder}/user/usys.S",
                    "line":16
                },
                {
                    "filepath": "${workspaceFolder}/user/usys.S",
                    "line":21
                },
                {
                    "filepath": "${workspaceFolder}/user/usys.S",
                    "line":26
                },
                {
                    "filepath": "${workspaceFolder}/user/usys.S",
                    "line":31
                },
                {
                    "filepath": "${workspaceFolder}/user/usys.S",
                    "line":36
                },
                {
                    "filepath": "${workspaceFolder}/user/usys.S",
                    "line":41
                },
                {
                    "filepath": "${workspaceFolder}/user/usys.S",
                    "line":46
                },
                {
                    "filepath": "${workspaceFolder}/user/usys.S",
                    "line":51
                },
                {
                    "filepath": "${workspaceFolder}/user/usys.S",
                    "line":56
                },
                {
                    "filepath": "${workspaceFolder}/user/usys.S",
                    "line":61
                },
                {
                    "filepath": "${workspaceFolder}/user/usys.S",
                    "line":66
                },
                {
                    "filepath": "${workspaceFolder}/user/usys.S",
                    "line":71
                },{
                    "filepath": "${workspaceFolder}/user/usys.S",
                    "line":76
                },
                {
                    "filepath": "${workspaceFolder}/user/usys.S",
                    "line":81
                },
                {
                    "filepath": "${workspaceFolder}/user/usys.S",
                    "line":86
                },
                {
                    "filepath": "${workspaceFolder}/user/usys.S",
                    "line":91
                },
                {
                    "filepath": "${workspaceFolder}/user/usys.S",
                    "line":96
                },
                {
                    "filepath": "${workspaceFolder}/user/usys.S",
                    "line":101
                },
                {
                    "filepath": "${workspaceFolder}/user/usys.S",
                    "line":106
                },
                {
                    "filepath": "${workspaceFolder}/kernel/trap.c",
                    "line":129
                }
            ],
            "hook_breakpoints":[
                {
                    "breakpoint": {
                        "file": "${workspaceFolder}/kernel/sysfile.c",
                        "line": 464
                    },
                    "behavior": {
                        "isAsync": true,
                        "functionArguments": "",
                        "functionBody": "let p=await this.getStringVariable('path'); return '${workspaceFolder}/user/'+p+'.c' "
                    }
                }
            ],
           "filePathToBreakpointGroupNames": {
                "isAsync": false,
                "functionArguments": "filePathStr",
                "functionBody": "if (filePathStr.includes('kernel')) { return ['kernel']; } else if (filePathStr === '${workspaceFolder}/user/usys.S') { return ['${workspaceFolder}/user/ln.c', '${workspaceFolder}/user/ls.c', '${workspaceFolder}/user/rm.c', '${workspaceFolder}/user/sh.c', '${workspaceFolder}/user/wc.c', '${workspaceFolder}/user/cat.c', '${workspaceFolder}/user/echo.c', '${workspaceFolder}/user/grep.c', '${workspaceFolder}/user/init.c', '${workspaceFolder}/user/kill.c', '${workspaceFolder}/user/ulib.c', '${workspaceFolder}/user/grind.c', '${workspaceFolder}/user/mkdir.c', '${workspaceFolder}/user/printf.c', '${workspaceFolder}/user/zombie.c', '${workspaceFolder}/user/umalloc.c', '${workspaceFolder}/user/forktest.c', '${workspaceFolder}/user/stressfs.c', '${workspaceFolder}/user/usertests.c']; } else if (filePathStr.includes('user') && filePathStr !== '${workspaceFolder}/user/usys.S') { return [filePathStr]; } else { return ['kernel']; }"
            },
            "breakpointGroupNameToDebugFilePath":{
                "isAsync": false,
                "functionArguments": "groupName",
                "functionBody": "if (groupName === 'kernel') {        return '${workspaceFolder}/kernel/kernel';    }    else {        let pathSplited = groupName.split('/');            let filename = pathSplited[pathSplited.length - 1].split('.');         let filenameWithoutExtension = filename[filename.length - 2];        return '${workspaceFolder}/user/' + '_' + filenameWithoutExtension;    }"
            }
        },
    ],
}
```

