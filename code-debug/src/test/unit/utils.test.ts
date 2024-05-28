import * as assert from 'assert';
import { MIInfo, MINode } from '../../backend/mi_parse';
import { getAddrFromMINode, getPathFromMINode } from '../../utils';

suite("parser", () => {
	test("Test getAddrFromMINode", () => {
		const testMINode1: MINode = {
			"token": 43,
			"outOfBandRecord": [],
			"resultRecords": {
				"resultClass": "done",
				"results": [
					[
						"threads", [
							[
								["id", "1"],
								["target-id", "Thread 1.1"],
								["details", "CPU#0 [running]"],
								[
									"frame", [
										["level", "0"],
										["addr", "0x0000000000010156"],
										["func", "initproc::main"],
										["args", []],
										["file", "src/bin/initprocWW.rs"],
										["fullname", "/home/czy/rCore-Tutorial-v3/user/src/bin/initproc.rs"],
										["line", "13"],
										["arch", "riscv:rv64"]
									]
								],
								[
									"state",
									"stopped"
								]
							]
						]
					],
					[
						"current-thread-id",
						"1"
					]
				]
			}
		} as MIInfo as MINode;
		assert.strictEqual(getAddrFromMINode(testMINode1), "0x0000000000010156");
	});
	test("Test getPathFromMINode", () => {
		const testMINode2: MINode = {
			"token": 23,
			"outOfBandRecord": [{
				"isStream": false,
				"type": "exec",
				"asyncClass": "stopped",
				"output": [
					["reason", "end-stepping-range"],
					["frame", [
						["addr", "0xffffffc0802cb77e"],
						["func", "axtask::task::first_into_user"],
						["args", [
							[
								["name", "kernel_sp"],
								["value", "18446743801062787952"]
							],
							[
								["name", "frame_base"],
								["value", "18446743801062787672"]
							]
						]],
						["file", "modules/axtask/src/task.rs"],
						["fullname", "/home/oslab/Starry/modules/axtask/src/task.rs"],
						["line", "746"],
						["arch", "riscv:rv64"]
					]],
					["thread-id", "1"],
					["stopped-threads", "all"]
				]
			}]
		} as MIInfo as MINode;
		assert.strictEqual(getPathFromMINode(testMINode2), "/home/oslab/Starry/modules/axtask/src/task.rs");
	});
});
