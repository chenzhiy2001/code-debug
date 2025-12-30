import { Border, BreakpointGroups, HookBreakpoint, HookBreakpointJSONFriendly, HookBreakpoints, MI2DebugSession, RunCommand } from "./mibase";
import {Breakpoint} from "./backend/backend";
import {
	DebugSession,
	InitializedEvent,
	TerminatedEvent,
	StoppedEvent,
	OutputEvent,
	Thread,
	StackFrame,
	Scope,
	Source,
	Handles,
} from "vscode-debugadapter";
import { DebugProtocol } from "vscode-debugprotocol";
import { MI2, escape } from "./backend/mi2/mi2";
import { SSHArguments, ValuesFormattingMode } from "./backend/backend";
import { isPrimitive } from "util";
import { ObjectAsFunction, toFunctionString } from "./utils";
import { OSState } from "./OSStateMachine";



export interface LaunchRequestArguments extends DebugProtocol.LaunchRequestArguments {
	cwd: string;
	target: string;
	gdbpath: string;
	env: any;
	debugger_args: string[];
	pathSubstitutions: { [index: string]: string };
	arguments: string;
	terminal: string;
	executable: string;
	remote: boolean;
	autorun: string[];
	stopAtConnect: boolean;
	stopAtEntry: boolean | string;
	ssh: SSHArguments;
	valuesFormatting: ValuesFormattingMode;
	frameFilters: boolean;
	printCalls: boolean;
	showDevDebugOutput: boolean;
	registerLimit: string;
}

export interface AttachRequestArguments extends DebugProtocol.AttachRequestArguments {
	cwd: string;
	target: string;
	gdbpath: string;
	env: any;
	debugger_args: string[];
	pathSubstitutions: { [index: string]: string };
	executable: string;
	remote: boolean;
	autorun: string[];
	stopAtConnect: boolean;
	stopAtEntry: boolean | string;
	ssh: SSHArguments;
	valuesFormatting: ValuesFormattingMode;
	frameFilters: boolean;
	printCalls: boolean;
	showDevDebugOutput: boolean;
	qemuPath: string;
	qemuArgs: string[];
	first_breakpoint_group:string;
	second_breakpoint_group:string;
	borderBreakpointsFromLaunchJSON:Border[]
	hookBreakpointsFromLaunchJSON:HookBreakpointJSONFriendly[];
	program_counter_id:number;
	kernel_memory_ranges:string[][];
	user_memory_ranges:string[][];
	filePathToBreakpointGroupNames:ObjectAsFunction;
	breakpointGroupNameToDebugFilePaths:ObjectAsFunction;
	registerLimit: string;
}

let NEXT_TERM_ID = 1;
class GDBDebugSession extends MI2DebugSession {
	protected override initializeRequest(response: DebugProtocol.InitializeResponse, args: DebugProtocol.InitializeRequestArguments): void {
		response.body.supportsGotoTargetsRequest = true;
		response.body.supportsHitConditionalBreakpoints = true;
		response.body.supportsConfigurationDoneRequest = true;
		response.body.supportsConditionalBreakpoints = true;
		response.body.supportsFunctionBreakpoints = true;
		response.body.supportsEvaluateForHovers = true;
		response.body.supportsSetVariable = true;
		response.body.supportsStepBack = true;
		response.body.supportsReadMemoryRequest = true;
		response.body.supportsWriteMemoryRequest = true;
		response.body.supportsLogPoints = true;
		this.sendResponse(response);
	}

	protected override launchRequest(response: DebugProtocol.LaunchResponse, args: LaunchRequestArguments): void {

		const dbgCommand = args.gdbpath || "gdb";
		if (!this.checkCommand(dbgCommand)) {
			this.sendErrorResponse(response, 104, `Configured debugger ${dbgCommand} not found.`);
			return;
		}
		this.miDebugger = new MI2(dbgCommand, ["-q", "--interpreter=mi2"], args.debugger_args, args.env);
		this.setPathSubstitutions(args.pathSubstitutions);
		this.initDebugger();
		this.quit = false;
		this.attached = false;
		this.initialRunCommand = RunCommand.RUN;
		this.isSSH = false;
		this.started = false;
		this.crashed = false;
		this.setValuesFormattingMode(args.valuesFormatting);
		this.miDebugger.frameFilters = !!args.frameFilters;
		this.miDebugger.printCalls = !!args.printCalls;
		this.miDebugger.debugOutput = !!args.showDevDebugOutput;
		this.stopAtEntry = args.stopAtEntry;
		this.miDebugger.registerLimit = args.registerLimit ?? "";
		if (args.ssh !== undefined) {
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
			this.isSSH = true;
			this.setSourceFileMap(args.ssh.sourceFileMap, args.ssh.cwd, args.cwd);
			this.miDebugger.ssh(args.ssh, args.ssh.cwd, args.target, args.arguments, args.terminal, false, args.autorun || []).then(() => {
				this.sendResponse(response);
			}, err => {
				this.sendErrorResponse(response, 105, `Failed to SSH: ${err.toString()}`);
			});
		} else {
			this.miDebugger.load(args.cwd, args.target, args.arguments, args.terminal, args.autorun || []).then(() => {
				this.sendResponse(response);
			}, err => {
				this.sendErrorResponse(response, 103, `Failed to load MI Debugger: ${err.toString()}`);
			});
		}
	}

	protected override attachRequest(response: DebugProtocol.AttachResponse, args: AttachRequestArguments): void {


		const dbgCommand = args.gdbpath || "gdb";

		/* We (code-debug the OS Debugger Devs) use custom shell scripts as "gdbpath", so we don't check commands here.
		if (!this.checkCommand(dbgCommand)) {
			this.sendErrorResponse(response, 104, `Configured debugger ${dbgCommand} not found.`);
			return;
		}
		*/
		this.miDebugger = new MI2(dbgCommand, ["-q", "--interpreter=mi2"], args.debugger_args, args.env);
		const converted_args = this.getQemuLaunchCmd(args);
		if (converted_args.length == 0) {
			this.sendErrorResponse(
				response,
				103,
				"`qemuPath` and `qemuArgs` property must be set in `launch.json`"
			);
			return;
		}

		this.program_counter_id = args.program_counter_id;
		this.first_breakpoint_group = args.first_breakpoint_group;
		this.second_breakpoint_group = args.second_breakpoint_group;
		this.kernel_memory_ranges = args.kernel_memory_ranges;
		this.user_memory_ranges = args.user_memory_ranges;
		this.filePathToBreakpointGroupNames = toFunctionString(args.filePathToBreakpointGroupNames);
		this.breakpointGroupNameToDebugFilePaths = toFunctionString(args.breakpointGroupNameToDebugFilePaths);
		//second_breakpoint_group 起到兜底的作用。万一内核中没有获取到nextBreakpointGroup，至少可以成功切换一次断点组。
		this.breakpointGroups = new BreakpointGroups(this.first_breakpoint_group, this, this.second_breakpoint_group);
		this.OSState = {status:this.OSStateMachine.initial} as OSState;
		this.runInTerminalRequest(
			{
				kind: "integrated",
				title: `code-debug External Terminal #${NEXT_TERM_ID++}`,
				cwd: "",
				args: converted_args,
			},
			10,
			undefined
		);
		this.setPathSubstitutions(args.pathSubstitutions);
		this.initDebugger();
		this.quit = false;
		this.attached = !args.remote;
		this.initialRunCommand = args.stopAtConnect ? RunCommand.NONE : RunCommand.CONTINUE;
		this.isSSH = false;
		this.setValuesFormattingMode(args.valuesFormatting);
		this.miDebugger.frameFilters = !!args.frameFilters;
		this.miDebugger.printCalls = !!args.printCalls;
		this.miDebugger.debugOutput = !!args.showDevDebugOutput;
		this.stopAtEntry = args.stopAtEntry;
		this.miDebugger.registerLimit = args.registerLimit ?? "";
		if (args.ssh !== undefined) {
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
			this.isSSH = true;
			this.setSourceFileMap(args.ssh.sourceFileMap, args.ssh.cwd, args.cwd);
			this.miDebugger.ssh(args.ssh, args.ssh.cwd, args.target, "", undefined, true, args.autorun || []).then(() => {
				this.sendResponse(response);
			}, err => {
				this.sendErrorResponse(response, 104, `Failed to SSH: ${err.toString()}`);
			});
		} else {
			if (args.remote) {
				this.miDebugger.connect(args.cwd, args.executable, args.target, args.autorun || []).then(() => {
					this.sendResponse(response);
				}, err => {
					this.sendErrorResponse(response, 102, `Failed to attach: ${err.toString()}`);
				});
			} else {
				this.miDebugger.attach(args.cwd, args.executable, args.target, args.autorun || []).then(() => {
					this.sendResponse(response);
				}, err => {
					this.sendErrorResponse(response, 101, `Failed to attach: ${err.toString()}`);
				});
			}
		}
	}



	// Add extra commands for source file path substitution in GDB-specific syntax
	protected setPathSubstitutions(substitutions: { [index: string]: string }): void {
		if (substitutions) {
			Object.keys(substitutions).forEach((source) => {
				this.miDebugger.extraCommands.push(
					'gdb-set substitute-path "' + escape(source) + '" "' + escape(substitutions[source]) + '"'
				);
			});
		}
	}

	private getQemuLaunchCmd(args: AttachRequestArguments): string[] {
		if (!args.qemuArgs?.length || !args.qemuPath?.length) {
			return [];
		}
		let r = [args.qemuPath];
		r = r.concat(args.qemuArgs);
		return r;
	}
}

DebugSession.run(GDBDebugSession);
