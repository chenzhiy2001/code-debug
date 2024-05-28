import * as vscode from "vscode";
import * as os from "os";
import * as ChildProcess from "child_process";
import * as path from "path";
import { ObjectAsFunction, prettyPrintJSON } from "../utils";
import { ADDRGETNETWORKPARAMS } from "dns";
import { Border } from "../mibase";
import { HookBreakpointJSONFriendly } from "../mibase";
import { Breakpoint } from "../backend/backend";


export function activate(context: vscode.ExtensionContext) {

	// Only allow a single Panel
	const currentPanel: vscode.WebviewPanel | undefined = undefined;

	context.subscriptions.push(
		vscode.commands.registerCommand('code-debug.eBPFPanel', () => {
			if(currentPanel){
				currentPanel.reveal(vscode.ViewColumn.Two);
			}else{
				const panel = vscode.window.createWebviewPanel(
					'eBPFPanel',
					'eBPFPanel',
					vscode.ViewColumn.Two,
					{
						enableScripts: true
					}
				);

				panel.webview.html = getWebviewContent();

				// Handle messages from the webview
				panel.webview.onDidReceiveMessage(
					message => {
						switch (message.command) {
							case 'send_gdb_cli_command':
								vscode.debug.activeDebugSession?.customRequest("send_gdb_cli_command", message.text);
								break;
							case 'send_gdb_mi_command':
								vscode.debug.activeDebugSession?.customRequest("send_gdb_mi_command", message.text);
								break;
							case 'enable_side_stub':
								vscode.debug.activeDebugSession?.customRequest("send_gdb_cli_command", "so " + vscode.workspace.workspaceFolders[0].uri.path + "/side-stub.py");
								break;
							case 'detect_side_stub_port':
								//😺
								ChildProcess.exec('cat ' + vscode.workspace.workspaceFolders[0].uri.path + '/code_debug_qemu_output_history.txt | grep -a "char device redirected to" | tail -1',
									(err, stdout, stderr) => {
										const re = /(?<=char device redirected to ).*(?= \()/;
										panel.webview.postMessage({ command: 'side_stub_port_is', text:re.exec(stdout)[0]});
										//console.log('stdout: ' + stdout);
										if(stderr){
											console.log('stderr in finding side_stub_port: ' + stderr);
										}
										if (err) {
											console.log('error in finding side_stub_port: ' + err);
										}
									});
								break;
							case 'exec_ebpf_daemon':
								ChildProcess.exec('active_window_id=$(xdotool search --onlyvisible --class "code" | tail -1) && xdotool windowactivate "$active_window_id" && xdotool key ctrl+grave && xdotool type ebpf_user_gdbserver && xdotool key Return');
								break;

						}
					},
					undefined,
					context.subscriptions
				);
				vscode.commands.registerCommand('code-debug.registerSelectedSymbolInUserSpace', () => {
					const activeTextEditor = vscode.window.activeTextEditor;
					if (activeTextEditor) {
						const selection = activeTextEditor.selection;
						if (!selection.isEmpty) {
							const selectedText = activeTextEditor.document.getText(selection);
							let sourceFilename = activeTextEditor.document.fileName;
							//get filename only. strip file path
							let i = sourceFilename.lastIndexOf('/');
							if (i <= 0) {
								i = sourceFilename.lastIndexOf('\\');
							}
							if (i >= 0) {
								sourceFilename = sourceFilename.substring(i + 1);
							}
							const binaryFileName = sourceFilename.replace(/\.[^/.]+$/, "");

							ChildProcess.exec('nm ' + vscode.workspace.workspaceFolders[0].uri.path + '/user/target/riscv64gc-unknown-none-elf/release/' + binaryFileName + ' | rustfilt |grep ' + selectedText,
								(err, stdout, stderr) => {
									console.log('stdout: ' + stdout);
									panel.webview.postMessage({ command: 'symbol_table_update', text:stdout.split('\n'), program_name:binaryFileName});
									//console.log('stdout: ' + stdout);
									if(stderr){
										console.log('stderr in registering selected symbol: ' + stderr);
									}
									if (err) {
										console.log('error in registering selected symbol: ' + err);
									}
								});
							//vscode.env.clipboard.writeText(text);
						}
					}
				});
				vscode.commands.registerCommand('code-debug.registerSelectedSymbolInKernel', () => {
					const activeTextEditor = vscode.window.activeTextEditor;
					if (activeTextEditor) {
						const selection = activeTextEditor.selection;
						if (!selection.isEmpty) {
							const selectedText = activeTextEditor.document.getText(selection);
							let sourceFilename = activeTextEditor.document.fileName;
							//get filename only. strip file path
							let i = sourceFilename.lastIndexOf('/');
							if (i <= 0) {
								i = sourceFilename.lastIndexOf('\\');
							}
							if (i >= 0) {
								sourceFilename = sourceFilename.substring(i + 1);
							}
							const binaryFileName = sourceFilename.replace(/\.[^/.]+$/, "");
							//todo rCore-Tutorial only!
							ChildProcess.exec('nm ' + vscode.workspace.workspaceFolders[0].uri.path + '/os/target/riscv64gc-unknown-none-elf/release/' + 'os' + ' | rustfilt |grep ' + selectedText,
								(err, stdout, stderr) => {
									console.log('stdout: ' + stdout);
									panel.webview.postMessage({ command: 'symbol_table_update', text:stdout.split('\n'), program_name:"kernel"});
									//console.log('stdout: ' + stdout);
									if(stderr){
										console.log('stderr in registering selected symbol: ' + stderr);
									}
									if (err) {
										console.log('error in registering selected symbol: ' + err);
									}
								});
							//vscode.env.clipboard.writeText(text);
						}
					}
				});
			}})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand("code-debug.examineMemoryLocation", examineMemory)
	);

	const setBorderBreakpointsFromLaunchJSONCmd = vscode.commands.registerCommand(
		"code-debug.setBorderBreakpointsFromLaunchJSON",
		() => {
			// launch.json configuration
			const config = vscode.workspace.getConfiguration(
				'launch',
				vscode.workspace.workspaceFolders[0].uri
			);
			// retrieve values
			const userConfNotSubstituted:any[] = config.get('configurations');
			const bordersNotSubstitued:Border[] = userConfNotSubstituted[0].border_breakpoints;
			const borders = bordersNotSubstitued.map(b=>new Border(variablesSubstitution(b.filepath), b.line));
			for(const border of borders){
				// we set the line index to 0 since currently we don't want to deal with positions in a line
				// notice that vscode.Position line number starts at 0 while the line number we usually use starts with 1
				const breakpoint = new vscode.SourceBreakpoint(new vscode.Location(vscode.Uri.file(border.filepath), new vscode.Position(border.line - 1, 0)), true);
				vscode.debug.addBreakpoints([breakpoint]);//this will go through setBreakPointsRequest in mibase.ts
				vscode.debug.activeDebugSession?.customRequest('setBorder', border);
			}
			vscode.window.showInformationMessage("All border breakpoints from launch.json are set.");
		}
	);
	const setHookBreakpointsFromLaunchJSONCmd = vscode.commands.registerCommand(
		"code-debug.setHookBreakpointsFromLaunchJSON",
		() => {
			// launch.json configuration
			const config = vscode.workspace.getConfiguration(
				'launch',
				vscode.workspace.workspaceFolders[0].uri
			);
			// retrieve values
			const userConfNotSubstituted:any[] = config.get('configurations');
			const hooksNotSubstituted:HookBreakpointJSONFriendly[] = userConfNotSubstituted[0].hook_breakpoints;
			const hooks = hooksNotSubstituted.map(h=>{
				return {
					breakpoint:{
						file:variablesSubstitution(h.breakpoint.file),
						line:h.breakpoint.line
					} as Breakpoint,
					behavior:new ObjectAsFunction(variablesSubstitution(h.behavior.functionArguments), variablesSubstitution(h.behavior.functionBody), h.behavior.isAsync)
				} as HookBreakpointJSONFriendly;
			});
			for(const hook of hooks){
				// we set the line index to 0 since currently we don't want to deal with positions in a line
				const breakpoint = new vscode.SourceBreakpoint(new vscode.Location(vscode.Uri.file(hook.breakpoint.file), new vscode.Position(hook.breakpoint.line - 1, 0)), true);
				vscode.debug.addBreakpoints([breakpoint]);//this will go through setBreakPointsRequest in mibase.ts
				vscode.debug.activeDebugSession?.customRequest('setHookBreakpoint', hook);
			}
			vscode.window.showInformationMessage("All hook breakpoints from launch.json are set.");
		}
	);

	/* example
	[
		{
			"lineNumber": 133,
			"uri": {
				"$mid": 1,
				"fsPath": "/home/oslab/rCore-Tutorial-v3-eBPF/rCore-Tutorial-v3/os/src/task/process.rs",
				"external": "file:///home/oslab/rCore-Tutorial-v3-eBPF/rCore-Tutorial-v3/os/src/task/process.rs",
				"path": "/home/oslab/rCore-Tutorial-v3-eBPF/rCore-Tutorial-v3/os/src/task/process.rs",
				"scheme": "file"
			}
		},
		null
	]
	*/

	//There is only 1 border per breakpoint group. So it you set border twice in a breakpoint group, the newer one will replace the older one.
	const setBreakpointAsBorderCmd = vscode.commands.registerCommand('code-debug.setBreakpointAsBorder', (...args) => {
		const uri = args[0].uri;
		const fullpath = args[0].uri.fsPath; // fsPath provides the path in the form appropriate for the os.
		const lineNumber = args[0].lineNumber;
		// we set the line index to 0 since currently we don't want to deal with positions in a line
		const breakpoint = new vscode.SourceBreakpoint(new vscode.Location(uri, new vscode.Position(lineNumber - 1, 0)), true);
		// vscode.debug.addBreakpoints([breakpoint]);//this will go through setBreakPointsRequest in mibase.ts
		vscode.debug.activeDebugSession?.customRequest('setBorder', new Border(fullpath, lineNumber));
	});

	const disableBorderOfThisBreakpointGroupCmd = vscode.commands.registerCommand('code-debug.disableBorderOfThisBreakpointGroup', (...args) => {
		const uri = args[0].uri;
		const fullpath = args[0].uri.fsPath; // fsPath provides the path in the form appropriate for the os.
		const lineNumber = args[0].lineNumber;
		vscode.debug.activeDebugSession?.customRequest('disableBorder', new Border(fullpath, lineNumber));
	});

	const removeAllCliBreakpointsCmd = vscode.commands.registerCommand(
		"code-debug.removeAllCliBreakpoints",
		() => {
			removeAllCliBreakpoints();
			vscode.window.showInformationMessage("All breakpoints including hidden ones are removed.");
		}
	);

	const disableCurrentBreakpointGroupBreakpointsCmd = vscode.commands.registerCommand(
		"code-debug.disableCurrentBreakpointGroupBreakpointsCmd",
		() => {
			vscode.window.showInformationMessage("disableCurrentBreakpointGroupBreakpoints received");
			vscode.debug.activeDebugSession?.customRequest("disableCurrentBreakpointGroupBreakpoints");
		}
	);

	context.subscriptions.push(
		setBorderBreakpointsFromLaunchJSONCmd,
		setHookBreakpointsFromLaunchJSONCmd,
		setBreakpointAsBorderCmd,
		disableBorderOfThisBreakpointGroupCmd,
		removeAllCliBreakpointsCmd,
		disableCurrentBreakpointGroupBreakpointsCmd,
	);

	const disposable = vscode.debug.registerDebugAdapterTrackerFactory("*", {
		createDebugAdapterTracker() {
			return {
				//监听VSCode即将发送给Debug Adapter的消息
				onWillReceiveMessage: (message) => {
					//console.log("//////////RECEIVED FROM EDITOR///////////\n "+JSON.stringify(message)+"\n//////////////////\n ");
				},
				onWillStartSession: () => {
					console.log("session started");
				},
				//监听Debug Adapter发送给VSCode的消息
				onDidSendMessage: (message) => {
					//处理自定义事件
					if (message.type === "event") {
						if (message.event === "eventTest") {
							console.log("Extension Received eventTest");
						}
						else if (message.event === "info") {
							console.log("//////////////INFO///////////");
							console.log(message.body);
						} else if (message.event === "showInformationMessage") {
							vscode.window.showInformationMessage(message.body);
						} else if (message.event === "printThisInConsole") {
							console.log(message.body);
						} else if (message.event === "showErrorMessage") {
							vscode.window.showErrorMessage(message.body);
						}
						else if (message.event === "output"){
							if (message.body.output.startsWith('eBPF Message: ')){//messages sent from
								vscode.window.showInformationMessage(message.body.output);
							}
						}
						else {
							//do nothing because too annoying
							//vscode.window.showInformationMessage('unknown message.event: '+JSON.stringify(message));
						}
					}
				},
			};
		},
	});
}

function examineMemory() {
	vscode.window
		.showInputBox({
			placeHolder: "Memory Location Reference",
			validateInput: () => "",
		})
		.then((ref_addr) => {
			const x = getUriForDebugMemory(vscode.debug.activeDebugSession?.id, ref_addr, {
				fromOffset: 0x00,
				toOffset: 0x2000,
			});
			const y = vscode.Uri.parse(x);
			vscode.commands.executeCommand("vscode.openWith", y, "hexEditor.hexedit");
		});
}

// reset breakpoints in VSCode, Debug Adapter, GDB
function removeAllCliBreakpoints() {
	vscode.commands.executeCommand("workbench.debug.viewlet.action.removeAllBreakpoints"); //VSCode
	vscode.debug.activeDebugSession?.customRequest("removeAllCliBreakpoints"); //Debug Adapter, GDB
}

export const getUriForDebugMemory = (
	sessionId: string,
	memoryReference: string,
	range: { fromOffset: number; toOffset: number },
	displayName = "memory"
) => {
	return (
		"vscode-debug-memory://" +
		sessionId +
		"/" +
		encodeURIComponent(memoryReference) +
		`/${encodeURIComponent(displayName)}.bin` +
		(range ? `?range=${range.fromOffset}:${range.toOffset}` : "")
	);
};

// if you get launch.json attributes in extension.ts, the variables in the attributes are not being substituted.
// so we have to do it on our own.
function variablesSubstitution(string:string, recursive = false):string {
	const workspaces = vscode.workspace.workspaceFolders;
	//original: const workspace = vscode.workspace.workspaceFolders.length ? vscode.workspace.workspaceFolders[0] : null;
	const workspace = vscode.workspace.workspaceFolders.length ? vscode.workspace.workspaceFolders[0] : undefined;
	const activeFile = vscode.window.activeTextEditor?.document;
	const absoluteFilePath = activeFile?.uri.fsPath;
	string = string.replace(/\${workspaceFolder}/g, workspace?.uri.fsPath);
	string = string.replace(/\${workspaceFolderBasename}/g, workspace?.name);
	string = string.replace(/\${file}/g, absoluteFilePath);
	let activeWorkspace = workspace;
	let relativeFilePath = absoluteFilePath;
	for (const workspace of workspaces) {
		if (absoluteFilePath.replace(workspace.uri.fsPath, '') !== absoluteFilePath) {
			activeWorkspace = workspace;
			relativeFilePath = absoluteFilePath.replace(workspace.uri.fsPath, '').substr(path.sep.length);
			break;
		}
	}
	const parsedPath = path.parse(absoluteFilePath);
	string = string.replace(/\${fileWorkspaceFolder}/g, activeWorkspace?.uri.fsPath);
	string = string.replace(/\${relativeFile}/g, relativeFilePath);
	string = string.replace(/\${relativeFileDirname}/g, relativeFilePath.substr(0, relativeFilePath.lastIndexOf(path.sep)));
	string = string.replace(/\${fileBasename}/g, parsedPath.base);
	string = string.replace(/\${fileBasenameNoExtension}/g, parsedPath.name);
	string = string.replace(/\${fileExtname}/g, parsedPath.ext);
	string = string.replace(/\${fileDirname}/g, parsedPath.dir.substr(parsedPath.dir.lastIndexOf(path.sep) + 1));
	string = string.replace(/\${cwd}/g, parsedPath.dir);
	string = string.replace(/\${pathSeparator}/g, path.sep);
	string = string.replace(/\${lineNumber}/g, (vscode.window.activeTextEditor.selection.start.line + 1).toString());
	string = string.replace(/\${selectedText}/g, vscode.window.activeTextEditor.document.getText(new vscode.Range(vscode.window.activeTextEditor.selection.start, vscode.window.activeTextEditor.selection.end)));
	string = string.replace(/\${env:(.*?)}/g, function (variable) {
		return process.env[variable.match(/\${env:(.*?)}/)[1]] || '';
	});
	string = string.replace(/\${config:(.*?)}/g, function (variable) {
		return vscode.workspace.getConfiguration().get(variable.match(/\${config:(.*?)}/)[1], '');
	});

	if (recursive && string.match(/\${(workspaceFolder|workspaceFolderBasename|fileWorkspaceFolder|relativeFile|fileBasename|fileBasenameNoExtension|fileExtname|fileDirname|cwd|pathSeparator|lineNumber|selectedText|env:(.*?)|config:(.*?))}/)) {
		string = variablesSubstitution(string, recursive);
	}
	return string;
}

function getWebviewContent(){
	return `<!DOCTYPE html>
	<html lang="en">
	<head>
		<meta charset="UTF-8">
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<title>WebView</title>
		<style type="text/css">
        body,html {
			width: 100%;
			height: 100%;
		}
		html *
		{
			font-size: var(--vscode-editor-font-size) !important;
			font-family: var(--vscode-editor-font-family) !important;
		}
		button{
			color: var(--vscode-button-foreground) !important;
			background-color: var(--vscode-button-background) !important;
		}
		table{
			border: 1px solid var(--vscode-tree-tableColumnsBorder);
  			border-collapse: collapse;
			border-color: var(--vscode-tree-tableColumnsBorder);
			background-color: var(--vscode-tree-tableOddRowsBackground);
		}
		td{
			/*height: 50px; */
    		width: 100px;
			text-align: center; 
    		vertical-align: middle;
		}
        
    	</style>
	</head>
	<script>
		const vscode = acquireVsCodeApi();
		function enable_side_stub(){
			vscode.postMessage({
								command: "enable_side_stub",
							});
		}

		function detect_side_stub_port(){
			vscode.postMessage({
								command: "detect_side_stub_port",
							});
		}

		function connect(){
			let pty = document.getElementById("port").value;
			vscode.postMessage({
								command: "send_gdb_mi_command",
								text: 'side-stub target remote '+pty,
							});
		}

		function register_kprobe_or_uprobe(){
			if (document.getElementById("program_name").value==="kernel"){
				vscode.postMessage({
								command: "send_gdb_mi_command",
								text: 'side-stub tracepoint-then-get-registers '+document.getElementById("address").value,
							});
			}else{
				vscode.postMessage({
								command: "send_gdb_mi_command",
								text: 'side-stub tracepoint_user_program_then_get_registers '+document.getElementById("program_name").value +" "+ document.getElementById("address").value,
							});
			}
			
		}

		function generate_symbol_table(symbol_table){
			for(i=0;i<symbol_table.length;i++){
				if (symbol_table[i].trim().length === 0 ){//line only contains whitespaces
					continue;
				}
				let result = symbol_table[i].split(' ');
				let addr_long = result[0];
				let addr = '0x'+addr_long.substring(addr_long.length - 8);

				//A character which depicts the symbol type. 
				//If the character is in lower case then the symbol is local but if the character is in upper case then the symbol is external
				let symbol_type = result[1];
				let name = symbol_table[i].split('::').slice(-1)[0];

				let item = document.createElement('tr');
				
				let addrElem = document.createElement('td');
				addrElem.innerText=addr;

				let symbolTypeElem = document.createElement('td');
				symbolTypeElem.innerText=symbol_type;

				let nameElem = document.createElement('td');
				nameElem.innerText=name;

				let buttonElem = document.createElement('td');
				buttonElem.innerHTML = '<button>Select</button>';
				buttonElem.addEventListener('click',fillRegisterText);
				buttonElem.func_name = name;
				buttonElem.addr = addr;

				item.appendChild(addrElem);
				item.appendChild(symbolTypeElem);
				item.appendChild(nameElem);
				item.appendChild(buttonElem);
				document.getElementById('symbol_table').innerHTML='<tr><th>Address</th><th>Symbol Type</th><th>Name</th><th>Select</th></tr>';
				document.getElementById('symbol_table').appendChild(item);
			}
		}

		function fillRegisterText(evt){

			document.getElementById('address').value = evt.currentTarget.addr;
			
		}
		function exec_ebpf_daemon(){
			vscode.postMessage({
								command: "exec_ebpf_daemon",
							});
		}
		window.addEventListener('message', event => {

			const message = event.data; // The JSON data our extension sent

			switch (message.command) {
				case 'side_stub_port_is':
					document.getElementById("port").value=message.text;
					break;
				case 'symbol_table_update':
					document.getElementById('program_name').value = message.program_name;
					document.getElementById('address').value = '';
					generate_symbol_table(message.text);
					break;
			}
		});

	</script>
	<body>
		
		<div id="connection" >
				
			<p style="margin-left: 20px;margin-top: 35px;">Port:<input id="port" style="margin-left: 10px;"><br>
				<button id="enable_side_stub_button" onclick="enable_side_stub()" style="margin-left: 50px;">   Enable Side Stub  </button><br>
				<button id="detect_button" onclick="detect_side_stub_port()" style="margin-left: 50px;"     >Detect Side Stub Port</button><br>
				<button id="connect_button" onclick="connect()" style="margin-left: 50px;"                  >       Connect       </button></p>
		</div>



		<div id="register" >
			<p style="margin-left: 20px">Program Name:<input id="program_name" style="margin-left: 10px;"></p><br>
			<p style="margin-left: 20px">Address:&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<input id="address" style="margin-left: 10px;"></p><br>
			<button onclick="exec_ebpf_daemon()" style="margin-left: 50px;"         >Exec eBPF Daemon</button>
			<button onclick="register_kprobe_or_uprobe()" style="margin-left: 50px;">    Register    </button>
		</div>
		<br><br>
		<table id="symbol_table">
		</table>


	</body>
	</html>`;
}
