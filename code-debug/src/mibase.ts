import * as DebugAdapter from 'vscode-debugadapter';
import { DebugSession, InitializedEvent, TerminatedEvent, StoppedEvent, ThreadEvent, OutputEvent, ContinuedEvent, Thread, StackFrame, Scope, Source, Handles } from 'vscode-debugadapter';
import { DebugProtocol } from 'vscode-debugprotocol';
import { Breakpoint, IBackend, Variable, VariableObject, ValuesFormattingMode, MIError } from './backend/backend';
import { MINode } from './backend/mi_parse';
import { expandValue, isExpandable } from './backend/gdb_expansion';
import { MI2 } from './backend/mi2/mi2';
import { exec, execSync } from 'child_process';
import * as systemPath from "path";
import * as net from "net";
import * as os from "os";
import * as fs from "fs";
import * as vscode from "vscode";

import { SourceFileMap } from "./source_file_map";
import { Address } from "cluster";
import { strict } from "assert";
import { debugPort } from "process";
import { RISCV_REG_NAMES } from "./frontend/consts";
import {Action, DebuggerActions, OSEvent, OSEvents, OSState, OSStateMachine, stateTransition} from './OSStateMachine';
import { Func } from 'mocha';
import { ObjectAsFunction, toFunctionString } from './utils';


const global = 1;

export type FunctionString = string;

export class HookBreakpointJSONFriendly{
	breakpoint:Breakpoint;
	behavior:ObjectAsFunction;
}
export function toHookBreakpoint(h:HookBreakpointJSONFriendly):HookBreakpoint{
	return new HookBreakpoint(h.breakpoint, toFunctionString(h.behavior));
}
export class HookBreakpoint{
	breakpoint:Breakpoint;
	behavior:FunctionString;
	constructor(breakpoint:Breakpoint, behavior:FunctionString){
		this.breakpoint = breakpoint;
		this.behavior = behavior;
	}
}
// use this to get next process name
export class HookBreakpoints {
	private hooks:HookBreakpoint[];
	constructor(hooks:HookBreakpoint[]){
		this.hooks = hooks;
	}
	// we cannot compare functions so we always override them
	public set(newHook:HookBreakpoint){
		let hookPositionAlreadyExists = false;
		for(const hook of this.hooks){
			if (hook.breakpoint.file === newHook.breakpoint.file && hook.breakpoint.line === newHook.breakpoint.line){
				hookPositionAlreadyExists = true;
				hook.behavior = newHook.behavior;
			}
		}
		if(hookPositionAlreadyExists === false){
			this.hooks.push(new HookBreakpoint(newHook.breakpoint, newHook.behavior));
		}
	}
	// again, we cannot compare functions, so if linenumber and filepath are the same, the hook will be removed
	public remove(breakpointOfHook:Breakpoint){
		this.hooks = this.hooks.filter(b=>(b.breakpoint.file !== breakpointOfHook.file || b.breakpoint.line !== breakpointOfHook.line));
	}
	// Implementing Iterable protocol
	[Symbol.iterator](): Iterator<HookBreakpoint> {
		let index = 0;
		const hooks = this.hooks;

		return {
			next(): IteratorResult<HookBreakpoint> {
				if (index < hooks.length) {
					return {
						done: false,
						value: hooks[index++]
					};
				} else {
					return {
						done: true,
						value: undefined // You can omit this line or return any other value here
					};
				}
			}
		};
	}
}

class ExtendedVariable {
	constructor(public name: string, public options: { "arg": any }) {
	}
}

class VariableScope {
	constructor(public readonly name: string, public readonly threadId: number, public readonly level: number) {
	}

	public static variableName(handle: number, name: string): string {
		return `var_${handle}_${name}`;
	}
}

export enum RunCommand {
	CONTINUE,
	RUN,
	NONE,
}

export class Border  {
	filepath:string;
	line:number;
	constructor(filepath:string, line:number){
		this.filepath = filepath;
		this.line = line;
	}
}
// we recommend the name of BreakpointGroup to be the full file path of the debugged file
// when one file is sufficient for one BreakpointGroup
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
//负责断点缓存，转换等
export class BreakpointGroups {
	protected groups: BreakpointGroup[];
	protected currentBreakpointGroupName: string;
	protected nextBreakpointGroup:string;
	protected readonly debugSession: MI2DebugSession; // A "pointer" pointing to debug session
	constructor(currentBreakpointGroupName: string, debugSession: MI2DebugSession, nextBreakpointGroup:string) {
		this.debugSession = debugSession;
		this.groups = [];
		this.groups.push(new BreakpointGroup(currentBreakpointGroupName, [], new HookBreakpoints([]), []));
		this.currentBreakpointGroupName = currentBreakpointGroupName;
		this.nextBreakpointGroup = nextBreakpointGroup;
	}
	// Let GDB remove breakpoints of current breakpoint group
	// but the breakpoints info in current breakpoint group remains unchanged
	public disableCurrentBreakpointGroupBreakpoints() {
		let currentIndex = -1;
		for (let j = 0; j < this.groups.length; j++) {
			if (this.groups[j].name === this.getCurrentBreakpointGroupName()) {
				currentIndex = j;
			}
		}
		//我们假设this.groups内缓存的断点信息和GDB里真实的断点信息完全一致。由于设置的断点有时会偏移几行，这不一定会发生。
		//因此，边界断点（Border属性）单独放置，而且边界断点是将已经设好的断点变成边界，因此不会有偏移的问题，从而避开这个问题。
		//未来可以尝试令gdb删除某个文件里的所有断点
		if (currentIndex === -1) {
			return;
		}
		this.groups[currentIndex].setBreakpointsArguments.forEach((e) => {
			this.debugSession.miDebugger.clearBreakPoints(e.source.path);
			this.debugSession.showInformationMessage("disableCurrentBreakpointGroupBreakpoints successed. index= " + currentIndex);
		});
	}
	//功能和disableCurrentBreakpointGroupBreakpoints有重合。
	//断点被触发时会调用该函数。如果空间发生变化（如kernel=>'src/bin/initproc.rs'）
	//缓存旧空间的断点，令GDB清除旧断点组的断点，卸载旧断点组的符号表文件，加载新断点组的符号表文件，加载新断点组的断点
	public updateCurrentBreakpointGroup(updateTo: string, continueAfterUpdate: boolean = false) {
		let newIndex = -1;
		for (let i = 0; i < this.groups.length; i++) {
			if (this.groups[i].name === updateTo) {
				newIndex = i;
			}
		}
		if (newIndex === -1) {
			this.groups.push(new BreakpointGroup(updateTo, [], new HookBreakpoints([]), []));
			newIndex = this.groups.length - 1;
		}
		let oldIndex = -1;
		for (let j = 0; j < this.groups.length; j++) {
			if (this.groups[j].name === this.getCurrentBreakpointGroupName()) {
				oldIndex = j;
			}
		}
		if (oldIndex === -1) {
			this.groups.push(new BreakpointGroup(this.getCurrentBreakpointGroupName(), [], new HookBreakpoints([]), []));
			oldIndex = this.groups.length - 1;
		}
		this.groups[oldIndex].setBreakpointsArguments.forEach((e) => {
			this.debugSession.miDebugger.clearBreakPoints(e.source.path);
		});

		let currentBreakpointGroupSymbolFiles:string[] = eval(this.debugSession.breakpointGroupNameToDebugFilePaths)(this.getCurrentBreakpointGroupName());
		for(let f of currentBreakpointGroupSymbolFiles){
			this.debugSession.miDebugger.removeSymbolFile(f);
		}
		
		let nextBreakpointGroupSymbolFiles:string[] = eval(this.debugSession.breakpointGroupNameToDebugFilePaths)(this.groups[newIndex].name);
		for(let f of nextBreakpointGroupSymbolFiles){
			this.debugSession.miDebugger.addSymbolFile(f);
		}

		const breakpointPromises = this.groups[newIndex].setBreakpointsArguments.map((args) => {
			return this.debugSession.miDebugger.clearBreakPoints(args.source.path).then(
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
							logMessage: brk.logMessage
						});
					});
					return Promise.all(all);
				},
				(msg) => {
					//TODO
				}
			);
		});

		Promise.all(breakpointPromises).then(() => {
			if (continueAfterUpdate) {
				this.debugSession.miDebugger.continue();
			}
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
			this.groups.push(new BreakpointGroup(groupName, [], new HookBreakpoints([]), []));
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
	// breakpoints are still there but they are no longer borders
	public disableBorder(border: Border) {
		const groupNamesOfBorder:string[] = eval(this.debugSession.filePathToBreakpointGroupNames)(border.filepath);
		for(const groupNameOfBorder of groupNamesOfBorder){
			let groupExists = false;
			for(const group of this.groups){
				if(group.name === groupNameOfBorder){
					groupExists = true;
					group.borders = [];
				}
			}
			if(groupExists === false){
				//do nothing
			}
		}
	}
	public updateHookBreakpoint(hook: HookBreakpointJSONFriendly) {
		const groupNames:string[] = eval(this.debugSession.filePathToBreakpointGroupNames)(hook.breakpoint.file);
		for(const groupName of groupNames){
			let groupExists = false;
			for(const existingGroup of this.groups){
				if(existingGroup.name === groupName){
					groupExists = true;
					existingGroup.hooks.set(toHookBreakpoint(hook));
					this.debugSession.showInformationMessage('hooks set ' + JSON.stringify(existingGroup.hooks));
				}
			}
			if(groupExists === false){
				this.groups.push(new BreakpointGroup(groupName, [], new HookBreakpoints([toHookBreakpoint(hook)]), undefined));
			}
		}
	}
	// the breakpoints are still set, but they will no longer trigger user-defined behavior.
	public disableHookBreakpoint(hook: HookBreakpointJSONFriendly) {
		const groupNames:string[] = eval(this.debugSession.filePathToBreakpointGroupNames)(hook.breakpoint.file);
		for(const groupName of groupNames){
			let groupExists = false;
			for(const existingGroup of this.groups){
				if(existingGroup.name === groupName){
					groupExists = true;
					existingGroup.hooks.remove(hook.breakpoint);
				}
			}
			if(groupExists === false){
				// do nothing
			}
		}
	}

	// 仅用于reset
	public removeAllBreakpoints() {
		this.groups = [];
	}
}

/// Debug Adapter
export class MI2DebugSession extends DebugSession {
	protected variableHandles = new Handles<
		VariableScope | string | VariableObject | ExtendedVariable
	>();
	protected variableHandlesReverse: { [id: string]: number } = {};
	protected scopeHandlesReverse: { [key: string]: number } = {};
	protected useVarObjects: boolean;
	protected quit: boolean;
	protected attached: boolean;
	protected initialRunCommand: RunCommand;
	protected stopAtEntry: boolean | string;
	public isSSH: boolean;
	public sourceFileMap: SourceFileMap;
	protected started: boolean;
	protected crashed: boolean;
	public miDebugger: MI2;
	protected commandServer: net.Server;
	protected serverPath: string;
	protected running: boolean = false;
	// following is related to OS debugging
	protected program_counter_id:number;
	protected first_breakpoint_group:string;
	protected second_breakpoint_group:string;
	public kernel_memory_ranges:string[][];
	public user_memory_ranges:string[][];
	protected breakpointGroups:BreakpointGroups;
	public filePathToBreakpointGroupNames:FunctionString;
	public breakpointGroupNameToDebugFilePaths:FunctionString;
	public OSStateMachine = OSStateMachine;
	public OSState:OSState;
	protected recentStopThreadID: number;
	protected OSDebugReady: boolean = false;
	protected currentHook:HookBreakpoint|undefined = undefined;



	public constructor(debuggerLinesStartAt1: boolean, isServer: boolean = false) {
		super(debuggerLinesStartAt1, isServer);
	}

	protected initDebugger() {
		this.miDebugger.on("launcherror", this.launchError.bind(this));
		this.miDebugger.on("quit", this.quitEvent.bind(this));
		this.miDebugger.on("exited-normally", this.quitEvent.bind(this));
		this.miDebugger.on("stopped", this.stopEvent.bind(this));
		this.miDebugger.on("msg", this.handleMsg.bind(this));
		this.miDebugger.on("breakpoint", this.handleBreakpoint.bind(this));
		this.miDebugger.on("watchpoint", this.handleBreak.bind(this)); // consider to parse old/new, too (otherwise it is in the console only)
		this.miDebugger.on("step-end", this.handleBreak.bind(this));
		//this.miDebugger.on("step-out-end", this.handleBreak.bind(this));  // was combined into step-end
		this.miDebugger.on("step-other", this.handleBreak.bind(this));
		this.miDebugger.on("signal-stop", this.handlePause.bind(this));
		this.miDebugger.on("thread-created", this.threadCreatedEvent.bind(this));
		this.miDebugger.on("thread-exited", this.threadExitedEvent.bind(this));
		this.miDebugger.once("debug-ready", () => {this.OSDebugReady = true; this.sendEvent(new InitializedEvent());});
		try {
			this.commandServer = net.createServer((c) => {
				c.on("data", (data) => {
					const rawCmd = data.toString();
					const spaceIndex = rawCmd.indexOf(" ");
					let func = rawCmd;
					let args = [];
					if (spaceIndex != -1) {
						func = rawCmd.substring(0, spaceIndex);
						args = JSON.parse(rawCmd.substring(spaceIndex + 1));
					}
					Promise.resolve((this.miDebugger as any)[func].apply(this.miDebugger, args)).then(data => {
						c.write(data.toString());
					});
				});
			});
			this.commandServer.on("error", (err) => {
				if (process.platform != "win32")
					this.handleMsg(
						"stderr",
						"Code-Debug WARNING: Utility Command Server: Error in command socket " +
							err.toString() +
							"\nCode-Debug WARNING: The examine memory location command won't work"
					);
			});
			if (!fs.existsSync(systemPath.join(os.tmpdir(), "code-debug-sockets")))
				fs.mkdirSync(systemPath.join(os.tmpdir(), "code-debug-sockets"));
			this.commandServer.listen(
				(this.serverPath = systemPath.join(
					os.tmpdir(),
					"code-debug-sockets",
					(
						"Debug-Instance-" + new Date(Date.now())
					) /*Math.floor(Math.random() * 36 * 36 * 36 * 36).toString(36)*/
						.toLowerCase()
				))
			);
		} catch (e) {
			if (process.platform != "win32")
				this.handleMsg(
					"stderr",
					"Code-Debug WARNING: Utility Command Server: Failed to start " +
						e.toString() +
						"\nCode-Debug WARNING: The examine memory location command won't work"
				);
		}
	}

	// verifies that the specified command can be executed
	protected checkCommand(debuggerName: string): boolean {
		try {
			const command = process.platform === 'win32' ? 'where' : 'command -v';
			execSync(`${command} ${debuggerName}`, { stdio: 'ignore' });
			return true;
		} catch (error) {
			return false;
		}
	}

	protected setValuesFormattingMode(mode: ValuesFormattingMode) {
		switch (mode) {
			case "disabled":
				this.useVarObjects = true;
				this.miDebugger.prettyPrint = false;
				break;
			case "prettyPrinters":
				this.useVarObjects = true;
				this.miDebugger.prettyPrint = true;
				break;
			case "parseText":
			default:
				this.useVarObjects = false;
				this.miDebugger.prettyPrint = false;
		}
	}

	protected handleMsg(type: string, msg: string) {
		if (type == "target") type = "stdout";
		if (type == "log") type = "stderr";
		this.sendEvent(new OutputEvent(msg, type));
	}

	/*
example: {"token":43,"outOfBandRecord":[],"resultRecords":{"resultClass":"done","results":[["threads",[[["id","1"],["target-id","Thread 1.1"],["details","CPU#0 [running]"],["frame",[["level","0"],["addr","0x0000000000010156"],["func","initproc::main"],["args",[]],["file","src/bin/initproc.rs"],["fullname","/home/czy/rCore-Tutorial-v3/user/src/bin/initproc.rs"],["line","13"],["arch","riscv:rv64"]]],["state","stopped"]]]],["current-thread-id","1"]]}}
*/
	protected handleBreakpoint(info: MINode) {
		const event = new StoppedEvent("breakpoint", parseInt(info.record("thread-id")));
		(event as DebugProtocol.StoppedEvent).body.allThreadsStopped =
			info.record("stopped-threads") == "all";
		this.sendEvent(event);
		if(this.OSDebugReady){
			this.recentStopThreadID = parseInt(info.record("thread-id"));
			this.OSStateTransition(new OSEvent(OSEvents.STOPPED));
		}


		// 	//this.sendEvent({ event: "info", body: info } as DebugProtocol.Event);
		// 	//TODO only for rCore currently
		// 	if (
		// 		this.addr2privilege(Number(getAddrFromMINode(info)))===privilegeLevel.kernel
		// 	) {
		// 		this.addressSpaces.updateCurrentSpace("kernel");
		// 		this.sendEvent({ event: "inKernel" } as DebugProtocol.Event);
		// 		if (
		// 			info.outOfBandRecord[0].output[3][1][3][1] === this.KERNEL_OUT_BREAKPOINTS_FILENAME &&
		// 			info.outOfBandRecord[0].output[3][1][5][1] === this.KERNEL_OUT_BREAKPOINTS_LINE+""
		// 		) {
		// 			this.sendEvent({ event: "kernelToUserBorder" } as DebugProtocol.Event);
		// 		}else if(info.outOfBandRecord[0].output[3][1][3][1] === "src/syscall/process.rs" &&
		// 		info.outOfBandRecord[0].output[3][1][5][1] === "49")//TODO hardcoded
		// 		{
		// 			this.miDebugger.sendCliCommand("p path").then((result)=>{

		// 				let info=this.miDebugger.getMIinfo(result.token);

		// 				const pname_ = /(?<=")(.*?)(?=\\)/g;
		// 				let info1=JSON.stringify(info);
		// 				this.sendEvent({ event: "showInformationMessage", body: "info.length-1= "+(info.length-1).toString()  } as DebugProtocol.Event);
		// 				let all_info="";
		// 				for(let i=info.length-1;i>=0;i--){
		// 					all_info=all_info + info[i].outOfBandRecord[0].content;
		// 				}
		// 				this.sendEvent({ event: "showInformationMessage", body: "all info: "+all_info  } as DebugProtocol.Event);
		// 				let addr_regex=/(0x|0X)[a-fA-F0-9]{8}/;
		// 				let pname0_addr=all_info.match(addr_regex)[0].toString();
		// 				this.sendEvent({ event: "newProcessNameAddr", body: pname0_addr  } as DebugProtocol.Event);

		// 				// let len_regex = /(?<= len: )[0-9]+/;
		// 				// let pname0_len=all_info.match(len_regex)[0].toString();

		// 				// let pname=pname0.slice(0,10);
		// 				// this.sendEvent({ event: "get_pname", body: pname } as DebugProtocol.Event);

		// 	})
		// }
		// 	} else {
		// 		const userProgramName = info.outOfBandRecord[0].output[3][1][4][1];
		// 		this.addressSpaces.updateCurrentSpace(userProgramName);
		// 		this.sendEvent({
		// 			event: "inUser",
		// 			body: { userProgramName: userProgramName },
		// 		} as DebugProtocol.Event);

	// 	}
	}

	protected handleBreak(info?: MINode) {
		const event = new StoppedEvent("step", info ? parseInt(info.record("thread-id")) : 1);
		(event as DebugProtocol.StoppedEvent).body.allThreadsStopped = info
			? info.record("stopped-threads") == "all"
			: true;
		this.sendEvent(event);
		if(this.OSDebugReady){
			this.recentStopThreadID = parseInt(info.record("thread-id"));
			this.OSStateTransition(new OSEvent(OSEvents.STOPPED));
		}
	}

	protected handlePause(info: MINode) {
		const event = new StoppedEvent("user request", parseInt(info.record("thread-id")));
		(event as DebugProtocol.StoppedEvent).body.allThreadsStopped =
			info.record("stopped-threads") == "all";
		this.sendEvent(event);
		if(this.OSDebugReady){
			this.recentStopThreadID = parseInt(info.record("thread-id"));
			this.OSStateTransition(new OSEvent(OSEvents.STOPPED));
		}
	}

	/*example of info:
	 {"token":23,"outOfBandRecord":
	 [{"isStream":false,"type":"exec","asyncClass":"stopped","output":
	 [["reason","end-stepping-range"],["frame",[["addr","0xffffffc0802cb77e"],["func","axtask::task::first_into_user"],["args",[[["name","kernel_sp"],["value","18446743801062787952"]],[["name","frame_base"],["value","18446743801062787672"]]]],["file","modules/axtask/src/task.rs"],["fullname","/home/oslab/Starry/modules/axtask/src/task.rs"],["line","746"],["arch","riscv:rv64"]]],["thread-id","1"],["stopped-threads","all"]]}]}
	 */
	protected stopEvent(info: MINode) {
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

	protected threadCreatedEvent(info: MINode) {
		this.sendEvent(new ThreadEvent("started", info.record("id")));
	}

	protected threadExitedEvent(info: MINode) {
		this.sendEvent(new ThreadEvent("exited", info.record("id")));
	}

	protected quitEvent() {
		this.quit = true;
		this.sendEvent(new TerminatedEvent());

		if (this.serverPath)
			fs.unlink(this.serverPath, (err) => {
				// eslint-disable-next-line no-console
				console.error("Failed to unlink debug server");
			});
	}

	protected launchError(err: any) {
		this.handleMsg(
			"stderr",
			"Could not start debugger process, does the program exist in filesystem?\n"
		);
		this.handleMsg("stderr", err.toString() + "\n");
		this.quitEvent();
	}

	protected override disconnectRequest(response: DebugProtocol.DisconnectResponse, args: DebugProtocol.DisconnectArguments): void {
		if (this.attached)
			this.miDebugger.detach();
		else
			this.miDebugger.stop();
		this.commandServer.close();
		this.commandServer = undefined;
		this.sendResponse(response);
	}

	protected override async setVariableRequest(response: DebugProtocol.SetVariableResponse, args: DebugProtocol.SetVariableArguments): Promise<void> {
		try {
			if (this.useVarObjects) {
				let name = args.name;
				const parent = this.variableHandles.get(args.variablesReference);
				if (parent instanceof VariableScope) {
					name = VariableScope.variableName(args.variablesReference, name);
				} else if (parent instanceof VariableObject) {
					name = `${parent.name}.${name}`;
				}

				const res = await this.miDebugger.varAssign(name, args.value);
				response.body = {
					value: res.result("value"),
				};
			} else {
				await this.miDebugger.changeVariable(args.name, args.value);
				response.body = {
					value: args.value,
				};
			}
			this.sendResponse(response);
		} catch (err) {
			this.sendErrorResponse(response, 11, `Could not continue: ${err}`);
		}
	}

	protected override setFunctionBreakPointsRequest(response: DebugProtocol.SetFunctionBreakpointsResponse, args: DebugProtocol.SetFunctionBreakpointsArguments): void {
		const all: Thenable<[boolean, Breakpoint]>[] = [];
		args.breakpoints.forEach(brk => {
			all.push(this.miDebugger.addBreakPoint({ raw: brk.name, condition: brk.condition, countCondition: brk.hitCondition }));
		});
		Promise.all(all).then(brkpoints => {
			const finalBrks: DebugProtocol.Breakpoint[] = [];
			brkpoints.forEach(brkp => {
				if (brkp[0])
					finalBrks.push({ line: brkp[1].line, verified: true });
			});
			response.body = {
				breakpoints: finalBrks
			};
			this.sendResponse(response);
		}, msg => {
			this.sendErrorResponse(response, 10, msg.toString());
		});
	}
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
			const groupNames:string[] = eval(this.filePathToBreakpointGroupNames)(path);
			const currentGroupName = this.breakpointGroups.getCurrentBreakpointGroupName();
			//保存这些断点信息到断点所属的断点组（可能不止一个）里
			for(const groupName of groupNames){
				this.breakpointGroups.saveBreakpointsToBreakpointGroup(args, groupName);
			}
			//注意，此时断点组管理模块里已经有完整的断点相关的信息了

			let flag = false;
			for(const groupName of groupNames){
				if(groupName === currentGroupName) { flag = true; }
			}
			//如果这些断点所属的断点组和当前断点组没有交集，比如还在内核态时就设置用户态的断点，就结束函数，不通知GDB设置断点
			if(flag === false) return;

			//反之，如果这些断点所属的断点组中有一个就是当前断点组，那么就通知GDB立即设置断点
			const all = args.breakpoints.map(brk => {
				return this.miDebugger.addBreakPoint({ file: path, line: brk.line, condition: brk.condition, countCondition: brk.hitCondition, logMessage: brk.logMessage });
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

	protected override threadsRequest(response: DebugProtocol.ThreadsResponse): void {
		if (!this.miDebugger) {
			this.sendResponse(response);
			return;
		}
		this.miDebugger.getThreads().then(threads => {
			response.body = {
				threads: []
			};
			for (const thread of threads) {
				const threadName = thread.name || thread.targetId || "<unnamed>";
				response.body.threads.push(new Thread(thread.id, thread.id + ":" + threadName));
			}
			this.sendResponse(response);
		}).catch((error: MIError) => {
			if (error.message === 'Selected thread is running.') {
				this.sendResponse(response);
				return;
			}
			this.sendErrorResponse(response, 17, `Could not get threads: ${error}`);
		});
	}

	// Supports 65535 threads.
	protected threadAndLevelToFrameId(threadId: number, level: number) {
		return (level << 16) | threadId;
	}
	protected frameIdToThreadAndLevel(frameId: number) {
		return [frameId & 0xffff, frameId >> 16];
	}

	protected override stackTraceRequest(response: DebugProtocol.StackTraceResponse, args: DebugProtocol.StackTraceArguments): void {
		this.miDebugger.getStack(args.startFrame, args.levels, args.threadId).then(stack => {
			const ret: StackFrame[] = [];
			stack.forEach(element => {
				let source = undefined;
				let path = element.file;
				if (path) {
					if (this.isSSH) {
						// convert ssh path to local path
						path = this.sourceFileMap.toLocalPath(path);
					} else if (process.platform === "win32") {
						if (path.startsWith("\\cygdrive\\") || path.startsWith("/cygdrive/")) {
							path = path[10] + ":" + path.substring(11); // replaces /cygdrive/c/foo/bar.txt with c:/foo/bar.txt
						}
					}
					source = new Source(element.fileName, path);
				}

				ret.push(new StackFrame(
					this.threadAndLevelToFrameId(args.threadId, element.level),
					element.function + (element.address ? "@" + element.address : ""),
					source,
					element.line,
					0));
			});
			response.body = {
				stackFrames: ret
			};
			this.sendResponse(response);
		}, err => {
			this.sendErrorResponse(response, 12, `Failed to get Stack Trace: ${err.toString()}`);
		});
	}

	protected override configurationDoneRequest(response: DebugProtocol.ConfigurationDoneResponse, args: DebugProtocol.ConfigurationDoneArguments): void {
		const promises: Thenable<any>[] = [];
		let entryPoint: string | undefined = undefined;
		let runToStart: boolean = false;
		// Setup temporary breakpoint for the entry point if needed.
		switch (this.initialRunCommand) {
			case RunCommand.CONTINUE:
			case RunCommand.NONE:
				if (typeof this.stopAtEntry == "boolean" && this.stopAtEntry)
					entryPoint = "main"; // sensible default
				else if (typeof this.stopAtEntry == "string") entryPoint = this.stopAtEntry;
				break;
			case RunCommand.RUN:
				if (typeof this.stopAtEntry == "boolean" && this.stopAtEntry) {
					if (this.miDebugger.features.includes("exec-run-start-option")) runToStart = true;
					else entryPoint = "main"; // sensible fallback
				} else if (typeof this.stopAtEntry == "string") entryPoint = this.stopAtEntry;
				break;
			default:
				throw new Error("Unhandled run command: " + RunCommand[this.initialRunCommand]);
		}
		if (entryPoint) promises.push(this.miDebugger.setEntryBreakPoint(entryPoint));
		switch (this.initialRunCommand) {
			case RunCommand.CONTINUE:
				promises.push(
					this.miDebugger.continue().then(() => {
						// Some debuggers will provide an out-of-band status that they are stopped
						// when attaching (e.g., gdb), so the client assumes we are stopped and gets
						// confused if we start running again on our own.
						//
						// If we don't send this event, the client may start requesting data (such as
						// stack frames, local variables, etc.) since they believe the target is
						// stopped.  Furthermore, the client may not be indicating the proper status
						// to the user (may indicate stopped when the target is actually running).
						this.sendEvent(new ContinuedEvent(1, true));
					})
				);
				break;
			case RunCommand.RUN:
				promises.push(
					this.miDebugger.start(runToStart).then(() => {
						this.started = true;
						if (this.crashed) this.handlePause(undefined);
					})
				);
				break;
			case RunCommand.NONE: {
				// Not all debuggers seem to provide an out-of-band status that they are stopped
				// when attaching (e.g., lldb), so the client assumes we are running and gets
				// confused when we don't actually run or continue.  Therefore, we'll force a
				// stopped event to be sent to the client (just in case) to synchronize the state.
				const event: DebugProtocol.StoppedEvent = new StoppedEvent("pause", 1);
				event.body.description = "paused on attach";
				event.body.allThreadsStopped = true;
				this.sendEvent(event);
				break;
			}
			default:
				throw new Error("Unhandled run command: " + RunCommand[this.initialRunCommand]);
		}
		Promise.all(promises)
			.then(() => {
				this.sendResponse(response);
			})
			.catch((err) => {
				this.sendErrorResponse(response, 18, `Could not run/continue: ${err.toString()}`);
			});
	}

	protected override scopesRequest(response: DebugProtocol.ScopesResponse, args: DebugProtocol.ScopesArguments): void {
		const scopes = new Array<Scope>();
		const [threadId, level] = this.frameIdToThreadAndLevel(args.frameId);

		const createScope = (scopeName: string, expensive: boolean): Scope => {
			const key: string = scopeName + ":" + threadId + ":" + level;
			let handle: number;

			if (this.scopeHandlesReverse.hasOwnProperty(key)) {
				handle = this.scopeHandlesReverse[key];
			} else {
				handle = this.variableHandles.create(new VariableScope(scopeName, threadId, level));
				this.scopeHandlesReverse[key] = handle;
			}

			return new Scope(scopeName, handle, expensive);
		};

		scopes.push(createScope("Locals", false));
		scopes.push(createScope("Registers", true));

		response.body = {
			scopes: scopes,
		};
		this.sendResponse(response);
	}

	protected override async variablesRequest(response: DebugProtocol.VariablesResponse, args: DebugProtocol.VariablesArguments): Promise<void> {
		const variables: DebugProtocol.Variable[] = [];
		const id: VariableScope | string | VariableObject | ExtendedVariable = this.variableHandles.get(args.variablesReference);

		const createVariable = (arg: string | VariableObject, options?: any) => {
			if (options)
				return this.variableHandles.create(new ExtendedVariable(typeof arg === 'string' ? arg : arg.name, options));
			else
				return this.variableHandles.create(arg);
		};

		const findOrCreateVariable = (varObj: VariableObject): number => {
			let id: number;
			if (this.variableHandlesReverse.hasOwnProperty(varObj.name)) {
				id = this.variableHandlesReverse[varObj.name];
			} else {
				id = createVariable(varObj);
				this.variableHandlesReverse[varObj.name] = id;
			}
			return varObj.isCompound() ? id : 0;
		};

		if (id instanceof VariableScope) {
			try {
				if (id.name == "Registers") {
					const registers = await this.miDebugger.getRegisters();
					for (const reg of registers) {
						variables.push({
							name: reg.name,
							value: reg.valueStr,
							variablesReference: 0
						});
					}
				} else {
					const stack: Variable[] = await this.miDebugger.getStackVariables(id.threadId, id.level);
					for (const variable of stack) {
						if (this.useVarObjects) {
							try {
								const varObjName = VariableScope.variableName(args.variablesReference, variable.name);
								let varObj: VariableObject;
								try {
									const changes = await this.miDebugger.varUpdate(varObjName);
									const changelist = changes.result("changelist");
									changelist.forEach((change: any) => {
										const name = MINode.valueOf(change, "name");
										const vId = this.variableHandlesReverse[name];
										const v = this.variableHandles.get(vId) as any;
										v.applyChanges(change);
									});
									const varId = this.variableHandlesReverse[varObjName];
									varObj = this.variableHandles.get(varId) as any;
								} catch (err) {
									if (err instanceof MIError && (err.message == "Variable object not found" || err.message.endsWith("does not exist"))) {
										varObj = await this.miDebugger.varCreate(id.threadId, id.level, variable.name, varObjName);
										const varId = findOrCreateVariable(varObj);
										varObj.exp = variable.name;
										varObj.id = varId;
									} else {
										throw err;
									}
								}
								variables.push(varObj.toProtocolVariable());
							} catch (err) {
								variables.push({
									name: variable.name,
									value: `<${err}>`,
									variablesReference: 0
								});
							}
						} else {
							if (variable.valueStr !== undefined) {
								let expanded = expandValue(createVariable, `{${variable.name}=${variable.valueStr})`, "", variable.raw);
								if (expanded) {
									if (typeof expanded[0] == "string")
										expanded = [
											{
												name: "<value>",
												value: prettyStringArray(expanded),
												variablesReference: 0
											}
										];
									variables.push(expanded[0]);
								}
							} else
								variables.push({
									name: variable.name,
									type: variable.type,
									value: variable.type,
									variablesReference: createVariable(variable.name)
								});
						}
					}
				}
				response.body = {
					variables: variables
				};
				this.sendResponse(response);
			} catch (err) {
				this.sendErrorResponse(response, 1, `Could not expand variable: ${err}`);
			}
		} else if (typeof id == "string") {
			// Variable members
			let variable;
			try {
				// TODO: this evaluates on an (effectively) unknown thread for multithreaded programs.
				variable = await this.miDebugger.evalExpression(JSON.stringify(id), 0, 0);
				try {
					let variableValue = variable.result("value");
					const pattern = /'([^']*)' <repeats (\d+) times>/g;
					variableValue = variableValue.replace(pattern, (_: any, char: string, count: string) => {
						const repeatCount = parseInt(count, 10) + 1;
						const repeatedArray = Array(repeatCount).fill(char);
						return `{${repeatedArray.map(item => `'${item}'`).join(', ')}}`;
					});
					let expanded = expandValue(createVariable, variableValue, id, variable);
					if (!expanded) {
						this.sendErrorResponse(response, 2, `Could not expand variable`);
					} else {
						if (typeof expanded[0] == "string")
							expanded = [
								{
									name: "<value>",
									value: prettyStringArray(expanded),
									variablesReference: 0
								}
							];
						response.body = {
							variables: expanded
						};
						this.sendResponse(response);
					}
				} catch (e) {
					this.sendErrorResponse(response, 2, `Could not expand variable: ${e}`);
				}
			} catch (err) {
				this.sendErrorResponse(response, 1, `Could not expand variable: ${err}`);
			}
		} else if (typeof id == "object") {
			if (id instanceof VariableObject) {
				// Variable members
				let children: VariableObject[];
				try {
					children = await this.miDebugger.varListChildren(id.name);
					const vars = children.map(child => {
						const varId = findOrCreateVariable(child);
						child.id = varId;
						return child.toProtocolVariable();
					});

					response.body = {
						variables: vars
					};
					this.sendResponse(response);
				} catch (err) {
					this.sendErrorResponse(response, 1, `Could not expand variable: ${err}`);
				}
			} else if (id instanceof ExtendedVariable) {
				const varReq = id;
				if (varReq.options.arg) {
					const strArr: DebugProtocol.Variable[] = [];
					let argsPart = true;
					let arrIndex = 0;
					const submit = () => {
						response.body = {
							variables: strArr
						};
						this.sendResponse(response);
					};
					const addOne = async () => {
						// TODO: this evaluates on an (effectively) unknown thread for multithreaded programs.
						const variable = await this.miDebugger.evalExpression(JSON.stringify(`${varReq.name}+${arrIndex})`), 0, 0);
						try {
							const expanded = expandValue(createVariable, variable.result("value"), varReq.name, variable);
							if (!expanded) {
								this.sendErrorResponse(response, 15, `Could not expand variable`);
							} else {
								if (typeof expanded == "string") {
									if (expanded == "<nullptr>") {
										if (argsPart)
											argsPart = false;
										else
											return submit();
									} else if (expanded[0] != '"') {
										strArr.push({
											name: "[err]",
											value: expanded,
											variablesReference: 0
										});
										return submit();
									}
									strArr.push({
										name: `[${(arrIndex++)}]`,
										value: expanded,
										variablesReference: 0
									});
									addOne();
								} else {
									strArr.push({
										name: "[err]",
										value: expanded,
										variablesReference: 0
									});
									submit();
								}
							}
						} catch (e) {
							this.sendErrorResponse(response, 14, `Could not expand variable: ${e}`);
						}
					};
					addOne();
				} else
					this.sendErrorResponse(response, 13, `Unimplemented variable request options: ${JSON.stringify(varReq.options)}`);
			} else {
				response.body = {
					variables: id
				};
				this.sendResponse(response);
			}
		} else {
			response.body = {
				variables: variables
			};
			this.sendResponse(response);
		}
	}

	protected override pauseRequest(response: DebugProtocol.ContinueResponse, args: DebugProtocol.ContinueArguments): void {
		this.miDebugger.interrupt().then(done => {
			this.sendResponse(response);
		}, msg => {
			this.sendErrorResponse(response, 3, `Could not pause: ${msg}`);
		});
	}

	protected override reverseContinueRequest(response: DebugProtocol.ReverseContinueResponse, args: DebugProtocol.ReverseContinueArguments): void {
		this.miDebugger.continue(true).then(done => {
			this.sendResponse(response);
		}, msg => {
			this.sendErrorResponse(response, 2, `Could not continue: ${msg}`);
		});
	}

	protected override continueRequest(response: DebugProtocol.ContinueResponse, args: DebugProtocol.ContinueArguments): void {
		this.miDebugger.continue().then(done => {
			this.sendResponse(response);
		}, msg => {
			this.sendErrorResponse(response, 2, `Could not continue: ${msg}`);
		});
	}

	protected override stepBackRequest(response: DebugProtocol.StepBackResponse, args: DebugProtocol.StepBackArguments): void {
		this.miDebugger.step(true).then(done => {
			this.sendResponse(response);
		}, msg => {
			this.sendErrorResponse(response, 4, `Could not step back: ${msg} - Try running 'target record-full' before stepping back`);
		});
	}

	protected override stepInRequest(response: DebugProtocol.NextResponse, args: DebugProtocol.NextArguments): void {
		this.miDebugger.step().then(done => {
			this.sendResponse(response);
		}, msg => {
			this.sendErrorResponse(response, 4, `Could not step in: ${msg}`);
		});
	}

	protected override stepOutRequest(response: DebugProtocol.NextResponse, args: DebugProtocol.NextArguments): void {
		this.miDebugger.stepOut().then(done => {
			this.sendResponse(response);
		}, msg => {
			this.sendErrorResponse(response, 5, `Could not step out: ${msg}`);
		});
	}

	protected override nextRequest(response: DebugProtocol.NextResponse, args: DebugProtocol.NextArguments): void {
		this.miDebugger.next().then(done => {
			this.sendResponse(response);
		}, msg => {
			this.sendErrorResponse(response, 6, `Could not step over: ${msg}`);
		});
	}

	protected override evaluateRequest(response: DebugProtocol.EvaluateResponse, args: DebugProtocol.EvaluateArguments): void {
		const [threadId, level] = this.frameIdToThreadAndLevel(args.frameId);
		if (args.context == "watch" || args.context == "hover") {
			this.miDebugger.evalExpression(args.expression, threadId, level).then(
				(res) => {
					response.body = {
						variablesReference: 0,
						result: res.result("value"),
					};
					this.sendResponse(response);
				},
				(msg) => {
					if (args.context == "hover") {
						// suppress error for hover as the user may just play with the mouse
						this.sendResponse(response);
					} else {
						this.sendErrorResponse(response, 7, msg.toString());
					}
				}
			);
		} else {
			this.miDebugger.sendUserInput(args.expression, threadId, level).then(
				(output) => {
					if (typeof output == "undefined")
						response.body = {
							result: "",
							variablesReference: 0,
						};
					else
						response.body = {
							result: JSON.stringify(output),
							variablesReference: 0,
						};
					this.sendResponse(response);
				},
				(msg) => {
					this.sendErrorResponse(response, 8, msg.toString());
				}
			);
		}
	}

	protected override gotoTargetsRequest(response: DebugProtocol.GotoTargetsResponse, args: DebugProtocol.GotoTargetsArguments): void {
		const path: string = this.isSSH ? this.sourceFileMap.toRemotePath(args.source.path) : args.source.path;
		this.miDebugger.goto(path, args.line).then(done => {
			response.body = {
				targets: [{
					id: 1,
					label: args.source.name,
					column: args.column,
					line: args.line
				}]
			};
			this.sendResponse(response);
		}, msg => {
			this.sendErrorResponse(response, 16, `Could not jump: ${msg}`);
		});
	}

	protected override gotoRequest(response: DebugProtocol.GotoResponse, args: DebugProtocol.GotoArguments): void {
		this.sendResponse(response);
	}

	protected setSourceFileMap(
		configMap: { [index: string]: string },
		fallbackGDB: string,
		fallbackIDE: string
	): void {
		if (configMap === undefined) {
			this.sourceFileMap = new SourceFileMap({ [fallbackGDB]: fallbackIDE });
		} else {
			this.sourceFileMap = new SourceFileMap(configMap, fallbackGDB);
		}
	}

	protected readMemoryRequest(
		response: DebugProtocol.ReadMemoryResponse,
		args: DebugProtocol.ReadMemoryArguments,
		request?: DebugProtocol.Request
	): void {
		if (args.count == 0) {
			// 不太清楚为啥会有0长度的读取命令，但这样的请求会使GDB返回错误。
			response.body = {
				address: "0x0",
				data: "",
			};
			this.sendResponse(response);
			return;
		}

		this.miDebugger.examineMemory(args.memoryReference, args.count).then(
			(data) => {
				console.log(data);

				const bytes = Buffer.alloc(data.contents.length / 2);
				for (let i = 0, c = 0; c < data.contents.length; c += 2, i += 1)
					bytes[i] = parseInt(data.contents.substr(c, 2), 16);

				const base64_data = bytes.toString("base64");

				response.body = {
					address: data.begin,
					data: base64_data,
				};
				this.sendResponse(response);
			},
			(err) => {
				this.sendEvent({ event: "showErrorMessage", body: err.toString() } as DebugProtocol.Event);
			}
		);
	}

	protected writeMemoryRequest(
		response: DebugProtocol.WriteMemoryResponse,
		args: DebugProtocol.WriteMemoryArguments,
		request?: DebugProtocol.Request
	): void {
		if (args.data.length == 0) {
			this.sendErrorResponse(response, 0);
			return;
		}

		const buff = Buffer.from(args.data, "base64");

		const hex = [];
		for (let i = 0; i < buff.length; i++) {
			const current = buff[i] < 0 ? buff[i] + 256 : buff[i];
			hex.push((current >>> 4).toString(16));
			hex.push((current & 0xf).toString(16));
		}
		const hex_to_backend = hex.join("");

		this.miDebugger
			.sendCommand("data-write-memory-bytes " + args.memoryReference + " " + hex_to_backend)
			.then(
				(result) => {
					this.sendResponse(response);
				},
				(err) => {
					this.sendErrorResponse(response, 0);
				}
			);
	}

	///返回消息可以用Event或者Response。用Response更规范，用Event代码更简单。
	protected customRequest(command: string, response: DebugProtocol.Response, args: any): void {
		switch (command) {
			case "eventTest":
				this.sendEvent({ event: "eventTest", body: ["test"] } as DebugProtocol.Event);
				this.sendResponse(response);
				break;
			case "removeAllCliBreakpoints": // removing cli breakpoints means remove breakpoints in both breakpoint group and GDB
				this.breakpointGroups.removeAllBreakpoints();
				this.miDebugger.sendCliCommand("del");
				break;
			case "disableCurrentBreakpointGroupBreakpoints":
				this.breakpointGroups.disableCurrentBreakpointGroupBreakpoints();
				break;
			case 'send_gdb_cli_command':
				this.miDebugger.sendCliCommand(args);
				break;
			case 'send_gdb_mi_command':
				this.miDebugger.sendCommand(args);
				break;
			case 'setBorder':
				// args have border type
				this.breakpointGroups.updateBorder(args as Border);
				break;
			case 'disableBorder':
				// args have border type
				this.breakpointGroups.disableBorder(args);
				break;
			case 'setHookBreakpoint':
				// args has type HookBreakpointJSONFriendly
				this.breakpointGroups.updateHookBreakpoint(args);
				break;
			default:
				this.showInformationMessage("unknown customRequest: " + command);
				return this.sendResponse(response);
		}
	}

	public showInformationMessage(info:string){
		this.sendEvent({
			event: "showInformationMessage",
			body: info,
		} as DebugProtocol.Event);

	}

	public async getStringVariable(name:string):Promise<string>{
		const node = await this.miDebugger.sendCliCommand('x /s ' + name ); // x /s may work
		const resultstring = this.miDebugger.getOriginallyNoTokenMINodes(node.token)[0].outOfBandRecord[0].content;
		this.showInformationMessage("`getStringVariable` got string: " + resultstring);
		return /"(.*?)"/.exec(resultstring)[1];// we want things INSIDE double quotes so it's [1], the first captured group.
	}

	public OSStateTransition(event: OSEvent){
		let actions:Action[];
		[this.OSState, actions] = stateTransition(this.OSStateMachine, this.OSState, event);
		// go through the actions to determine
		// what should be done
		actions.forEach(action => {this.doAction(action);});
	}

	public doAction(action:Action){
		if(action.type === DebuggerActions.check_if_kernel_yet){
			this.showInformationMessage('doing action: check_if_kernel_yet');
			this.miDebugger.getSomeRegisters([this.program_counter_id]).then(v => {
				// 检查是否拿到了寄存器数据
				if(!v || v.length === 0 || !v[0]){
					console.warn("【Code-Debug】当前无法获取 PC 寄存器 (check_if_kernel_yet)，跳过状态检查。");
					return;
				}
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
				if (!v || v.length === 0 || !v[0]) {
					console.warn("【Code-Debug】当前无法获取 PC 寄存器 (check_if_user_yet)，跳过状态检查。");
					return;
				}
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
			const kernelToUserBorders = this.breakpointGroups.getCurrentBreakpointGroup().borders; // 获取所有边界断点
			//const kernelToUserBorderFile = this.breakpointGroups.getCurrentBreakpointGroup().border?.filepath;
			//const kernelToUserBorderLine = this.breakpointGroups.getCurrentBreakpointGroup().border?.line;
			//todo if you are trying to do multi-core debugging, you might need to modify the 3rd argument.
			this.miDebugger.getStack(0, 1, this.recentStopThreadID).then(v=>{
				// 预防性检查：Stack 也可能为空，防止 v[0].file 崩溃
				if (!v || v.length === 0 || !v[0]) {
					console.warn("【Code-Debug】无法获取堆栈信息，跳过边界检查。");
					return;
				}
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
		// obviously we are at current user breakpoint group when executing this action
		else if(action.type === DebuggerActions.check_if_user_to_kernel_border_yet){
			this.showInformationMessage('doing action: check_if_user_to_kernel_border_yet');
			let filepath:string = "";
			let lineNumber:number = -1;
			const userToKernelBorders = this.breakpointGroups.getCurrentBreakpointGroup().borders; // 获取所有边界断点
			//const userToKernelBorderFile = this.breakpointGroups.getCurrentBreakpointGroup().border?.filepath;
			//const userToKernelBorderLine = this.breakpointGroups.getCurrentBreakpointGroup().border?.line;
			//todo if you are trying to do multi-core debugging, you might need to modify the 3rd argument.
			this.miDebugger.getStack(0, 1, this.recentStopThreadID).then(v=>{
				// 预防性检查：Stack 也可能为空，防止 v[0].file 崩溃
				if (!v || v.length === 0 || !v[0]) {
					console.warn("【Code-Debug】无法获取堆栈信息，跳过边界检查。");
					return;
				}
				filepath = v[0].file;
				lineNumber = v[0].line;

				 // 检查当前的文件路径和行号是否与任何一个边界断点匹配
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
				// 预防性检查：Stack 也可能为空，防止 v[0].file 崩溃
				if (!v || v.length === 0 || !v[0]) {
					console.warn("【Code-Debug】无法获取堆栈信息，跳过边界检查。");
					return;
				}
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
			this.breakpointGroups.updateCurrentBreakpointGroup(this.breakpointGroups.getNextBreakpointGroup(),true);
			this.breakpointGroups.setNextBreakpointGroup(high_level_breakpoint_group_name);// if a hook is triggered during low level execution, NextBreakpointGroup will be set to the return value of hook behavior function.
		}
		else if(action.type === DebuggerActions.low_level_switch_breakpoint_group_to_high_level){//for example, kernel to user
			const low_level_breakpoint_group_name = this.breakpointGroups.getCurrentBreakpointGroupName();
			const high_level_breakpoint_group_name = this.breakpointGroups.getNextBreakpointGroup();
			this.breakpointGroups.updateCurrentBreakpointGroup(high_level_breakpoint_group_name,true);
			this.breakpointGroups.setNextBreakpointGroup(low_level_breakpoint_group_name);
		}

	}

	public isKernelAddr(addr64:number):boolean{
		for(let i = 0;i < this.kernel_memory_ranges.length;i++){//[a,b) 左闭右开
			if(Number(this.kernel_memory_ranges[i][0]) <= addr64 && addr64 < Number(this.kernel_memory_ranges[i][1])){
				return true;
			}
		}
		return false;
	}
	public isUserAddr(addr64: number):boolean {
		for(let i = 0;i < this.user_memory_ranges.length;i++){//[a,b) 左闭右开
			if(Number(this.user_memory_ranges[i][0]) <= addr64 && addr64 < Number(this.user_memory_ranges[i][1])){
				return true;
			}
		}
		return false;
	}
}

function prettyStringArray(strings: any) {
	if (typeof strings == "object") {
		if (strings.length !== undefined) return strings.join(", ");
		else return JSON.stringify(strings);
	} else return strings;
}
