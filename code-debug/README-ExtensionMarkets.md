# code-debug Operating System Debugger

This extension supports debugging across kernel and multiple user processes. For more details please visit our [Github repository](https://github.com/chenzhiy2001/code-debug).

Non OS-related parts are based on [WebFreak001/code-debug](https://github.com/WebFreak001/code-debug).

## Using the Extension
1. install the extension from an Extension Market.
2. install dependencies: 
	- `qemu`, `gdb`,
	- optional for ebpf debugging capabilities: `nm`, `rustfilt`, `cat`, `grep`, `tail`, `xdotool`.
3. create `launch.json` in `.vscode` folder, then start debugging.

## `launch.json` example
```json
{
    "version": "0.2.0",
    "configurations": [
        {
            "type": "gdb",
            "request": "attach",
            "name": "Attach to Qemu",
            "autorun": ["add-symbol-file ${workspaceFolder}/os/target/riscv64gc-unknown-none-elf/release/os"],
            "target": ":1234",
            "remote": true,
            "cwd": "/home/oslab/rCore-Tutorial-v3-eBPF/rCore-Tutorial-v3",
            "valuesFormatting": "parseText",
            "gdbpath": "${workspaceFolder}/riscv64-unknown-elf-gdb-rust.sh",
            "showDevDebugOutput":true,
            "internalConsoleOptions": "openOnSessionStart",
            "printCalls": true,
            "stopAtConnect": true,
            "qemuPath": "${workspaceFolder}/qemu-system-riscv64-with-logs.sh",
            "qemuArgs": [
                "-M",
                "128m",
                "-machine",
                "virt",
                "-bios",
                "${workspaceFolder}/bootloader/rustsbi-qemu.bin",
                "-display",
                "none",
                "-device",
                "loader,file=${workspaceFolder}/os/target/riscv64gc-unknown-none-elf/release/os.bin,addr=0x80200000",
                "-drive",
                "file=${workspaceFolder}/user/target/riscv64gc-unknown-none-elf/release/fs.img,if=none,format=raw,id=x0",
                "-device",
                "virtio-blk-device,drive=x0",
                "-device",
                "virtio-gpu-device",
                "-device",
                "virtio-keyboard-device",
                "-device",
                "virtio-mouse-device",
                "-device",
                "virtio-net-device,netdev=net0",
                "-netdev",
                "user,id=net0,hostfwd=udp::6200-:2000,hostfwd=tcp::6201-:80",
                "-serial",
                "stdio",
                "-serial",
                "pty",
                "-s",
                "-S"
            ],
            "program_counter_id": 32,
            "first_breakpoint_group": "kernel",
            "second_breakpoint_group":"${workspaceFolder}/user/src/bin/initproc.rs",
            "kernel_memory_ranges":[["0x80000000","0xffffffffffffffff"]],
            "user_memory_ranges":[["0x0000000000000000","0x80000000"]],
            "border_breakpoints":[
                {
                    "filepath": "${workspaceFolder}/user/src/syscall.rs",
                    "line": 39
                },
                {
                    "filepath": "${workspaceFolder}/os/src/trap/mod.rs",
                    "line": 152
                }
            ],
            "hook_breakpoints":[
                {
                    "breakpoint": {
                        "file": "${workspaceFolder}/os/src/syscall/process.rs",
                        "line": 49
                    },
                    "behavior": {
                        "isAsync": true,
                        "functionArguments": "",
                        "functionBody": "let p=await this.getStringVariable('path'); return '${workspaceFolder}/user/src/bin/'+p+'.rs'"
                    }
                }
            ],
            "filePathToBreakpointGroupNames":{
                "isAsync": false,
                "functionArguments": "filePathStr",
                "functionBody": "     if (filePathStr.includes('os/src')) {        return ['kernel'];    }    else if (filePathStr.includes('user/src/bin')) {        return [filePathStr];    }    else if (!filePathStr.includes('user/src/bin') && filePathStr.includes('user/src')) {        return ['${workspaceFolder}/user/src/bin/adder_atomic.rs', '${workspaceFolder}/user/src/bin/adder_mutex_blocking.rs', '${workspaceFolder}/user/src/bin/adder_mutex_spin.rs', '${workspaceFolder}/user/src/bin/adder_peterson_spin.rs', '${workspaceFolder}/user/src/bin/adder_peterson_yield.rs', '${workspaceFolder}/user/src/bin/adder.rs', '${workspaceFolder}/user/src/bin/adder_simple_spin.rs', '${workspaceFolder}/user/src/bin/adder_simple_yield.rs', '${workspaceFolder}/user/src/bin/barrier_condvar.rs', '${workspaceFolder}/user/src/bin/barrier_fail.rs', '${workspaceFolder}/user/src/bin/cat.rs', '${workspaceFolder}/user/src/bin/cmdline_args.rs', '${workspaceFolder}/user/src/bin/condsync_condvar.rs', '${workspaceFolder}/user/src/bin/condsync_sem.rs', '${workspaceFolder}/user/src/bin/count_lines.rs', '${workspaceFolder}/user/src/bin/eisenberg.rs', '${workspaceFolder}/user/src/bin/exit.rs', '${workspaceFolder}/user/src/bin/fantastic_text.rs', '${workspaceFolder}/user/src/bin/filetest_simple.rs', '${workspaceFolder}/user/src/bin/forktest2.rs', '${workspaceFolder}/user/src/bin/forktest.rs', '${workspaceFolder}/user/src/bin/forktest_simple.rs', '${workspaceFolder}/user/src/bin/forktree.rs', '${workspaceFolder}/user/src/bin/gui_rect.rs', '${workspaceFolder}/user/src/bin/gui_simple.rs', '${workspaceFolder}/user/src/bin/gui_snake.rs', '${workspaceFolder}/user/src/bin/gui_uart.rs', '${workspaceFolder}/user/src/bin/hello_world.rs', '${workspaceFolder}/user/src/bin/huge_write_mt.rs', '${workspaceFolder}/user/src/bin/huge_write.rs', '${workspaceFolder}/user/src/bin/infloop.rs', '${workspaceFolder}/user/src/bin/initproc.rs', '${workspaceFolder}/user/src/bin/inputdev_event.rs', '${workspaceFolder}/user/src/bin/matrix.rs', '${workspaceFolder}/user/src/bin/mpsc_sem.rs', '${workspaceFolder}/user/src/bin/peterson.rs', '${workspaceFolder}/user/src/bin/phil_din_mutex.rs', '${workspaceFolder}/user/src/bin/pipe_large_test.rs', '${workspaceFolder}/user/src/bin/pipetest.rs', '${workspaceFolder}/user/src/bin/priv_csr.rs', '${workspaceFolder}/user/src/bin/priv_inst.rs', '${workspaceFolder}/user/src/bin/race_adder_arg.rs', '${workspaceFolder}/user/src/bin/random_num.rs', '${workspaceFolder}/user/src/bin/run_pipe_test.rs', '${workspaceFolder}/user/src/bin/sleep.rs', '${workspaceFolder}/user/src/bin/sleep_simple.rs', '${workspaceFolder}/user/src/bin/stackful_coroutine.rs', '${workspaceFolder}/user/src/bin/stackless_coroutine.rs', '${workspaceFolder}/user/src/bin/stack_overflow.rs', '${workspaceFolder}/user/src/bin/store_fault.rs', '${workspaceFolder}/user/src/bin/sync_sem.rs', '${workspaceFolder}/user/src/bin/tcp_simplehttp.rs', '${workspaceFolder}/user/src/bin/threads_arg.rs', '${workspaceFolder}/user/src/bin/threads.rs', '${workspaceFolder}/user/src/bin/udp.rs', '${workspaceFolder}/user/src/bin/until_timeout.rs', '${workspaceFolder}/user/src/bin/user_shell.rs', '${workspaceFolder}/user/src/bin/usertests.rs', '${workspaceFolder}/user/src/bin/yield.rs'];    }    else        return ['kernel'];"
            },
            "breakpointGroupNameToDebugFilePath":{
                "isAsync": false,
                "functionArguments": "groupName",
                "functionBody": "if (groupName === 'kernel') {        return '${workspaceFolder}/os/target/riscv64gc-unknown-none-elf/release/os';    }    else {        let pathSplited = groupName.split('/');        let filename = pathSplited[pathSplited.length - 1].split('.');        let filenameWithoutExtension = filename[filename.length - 2];        return '${workspaceFolder}/user/target/riscv64gc-unknown-none-elf/release/' + filenameWithoutExtension;    }"
            }
        },
    ],
}
```