## 升级 rCore-Tutorial 版本时遇到的问题

我尝试把 [rcore-ebpf](https://github.com/cubele/rCore-Tutorial-Code-2022A/tree/main) 移植到最新版本
的 rCore-Tutorial-v3（[链接](https://github.com/rcore-os/rCore-Tutorial-v3)）上。修改后的版本的仓库
在[这里](https://github.com/chenzhiy2001/rcore-ebpf/commit/8235899cfaf70911a47acd3a586c2e1a651f34a5)。

遇到的问题是，执行效果和原来的不一致。具体输出见下：

<table>
<tr>
<td> Before </td> <td> After </td>
</tr>
<tr>
<td>

```shell
Rust user shell
>> ebpf_kern_map
[kernel] Exception(InstructionPageFault) in application, bad addr = 0x0, bad instruction = 0x0, core dumped.
Shell: Process 2 exited with code -2
```

</td>
<td>
    
```shell
Rust user shell
>> ebpf_kern_map
[kernel] Segmentation Fault, SIGSEGV=11
```
</td>
</tr>
<tr>
<td>

```shell
>> ebpf_kern_time1
[kernel] Exception(InstructionPageFault) in application, bad addr = 0x0, bad instruction = 0x0, core dumped.
Shell: Process 2 exited with code -2
```

</td>
<td>
    
```shell
>> ebpf_kern_time1
[kernel] Segmentation Fault, SIGSEGV=11
```
</td>
</tr>
<tr>
<td>

```shell
>> ebpf_user_kernmaptest
ELF content: 464c457f 10102 0 0
cmd = 0
[ INFO] sys_bpf cmd: 0, bpf_attr: 32568, size: 32
[TRACE] bpf object create (fd):70000000
cmd = 2
[ INFO] sys_bpf cmd: 2, bpf_attr: 32568, size: 32
[TRACE] bpf map ops fd:1879048192, op:Update key:7f70 value:7f74
cmd = 1000
[ INFO] sys_bpf cmd: 1000, bpf_attr: 32616, size: 32
[TRACE] prog load attr
 prog_base:2ee0 prog_size=5704 map_base:7f98 map_num=1
[TRACE] insert map: map_fd fd: 1879048192
[TRACE] bpf program load ex
[TRACE] bpf map pushed fd: 1879048192
[TRACE] symbol table
[ INFO] insert map sym, idx: 10, addr: 80544800
[TRACE] bpf prog relocate entry idx: 10 offset:a8 type:1 to addr:80544800
[TRACE] bpf prog relocate entry idx: 10 offset:37 type:1 to addr:80544800
[TRACE] bpf prog relocate entry idx: 10 offset:60 type:10 to addr:80544800
[ INFO] before compile
[TRACE] bpf object create (fd):70000001
[TRACE] bpf prog loadex finished!
[TRACE] load ex ret: 1879048193
load ex: 70000001
target: kprobe$<linux_syscall::Syscall>::sys_openat len: 43
cmd = 8
[ INFO] sys_bpf cmd: 8, bpf_attr: 32616, size: 32
[TRACE] target name str: kprobe$<linux_syscall::Syscall>::sys_openat
[TRACE] bpf prog attached! tracepoint symbol:<linux_syscall::Syscall>::sys_openat addr: 80217d36
attach: 0
busy loop for 2 times
open from user
[kernel] breakpoint at 0x80217d36
[ INFO] run attached progs!
enter map.o!
map fd 1879048192
[TRACE] bpf map ops fd:1879048192, op:LookUp key:ffffffffffff2ad4 value:ffffffffffff2ad0
[TRACE] bpf map ops fd:1879048192, op:Update key:ffffffffffff2ad4 value:ffffffffffff2acc
inc value from 12345 to 12346
[ INFO] run attached progs exit!
[kernel] breakpoint at 0x805e7002
open from user
[kernel] breakpoint at 0x80217d36
[ INFO] run attached progs!
enter map.o!
map fd 1879048192
[TRACE] bpf map ops fd:1879048192, op:LookUp key:ffffffffffff2ad4 value:ffffffffffff2ad0
[TRACE] bpf map ops fd:1879048192, op:Update key:ffffffffffff2ad4 value:ffffffffffff2acc
inc value from 12346 to 12347
[ INFO] run attached progs exit!
[kernel] breakpoint at 0x805e7002
detach
cmd = 9
[ INFO] sys_bpf cmd: 9, bpf_attr: 32616, size: 32
[TRACE] detach fd 1879048193
Shell: Process 2 exited with code 0
```

</td>
<td>
    
```shell
>> ebpf_user_kernmaptest
ELF content: 464c457f 10102 0 0
cmd = 0
cmd = 2
cmd = 1000
load ex: 70000001
target: kprobe$<linux_syscall::Syscall>::sys_openat len: 43
cmd = 8
attach: 0
busy loop for 2 times
open from user
[kernel] breakpoint at 0x802135f6
enter map.o!
map fd 1879048192
inc value from 12345 to 12346
[kernel] breakpoint at 0x816f8002
open from user
[kernel] breakpoint at 0x802135f6
enter map.o!
map fd 1879048192
inc value from 12346 to 12347
[kernel] breakpoint at 0x816f8002
detach
cmd = 9
```
</td>
</tr>
<tr>
<td>

```shell
>> ebpf_user_maptest
Start test on bpf array map, this is a just a test in user space
cmd = 0
[ INFO] sys_bpf cmd: 0, bpf_attr: 28488, size: 32
[TRACE] bpf object create (fd):70000002
fd is 1879048194
bpf array with fd: 1879048194 created
cmd = 1
[ INFO] sys_bpf cmd: 1, bpf_attr: 28488, size: 32
[TRACE] bpf map ops fd:1879048194, op:LookUp key:6f7c value:6f80
test lookup_elem index=3, get value=%ld
cmd = 2
[ INFO] sys_bpf cmd: 2, bpf_attr: 28488, size: 32
[TRACE] bpf map ops fd:1879048194, op:Update key:6f7c value:6f80
test update_elem index=3 to %ld, and get value=%ld
cmd = 2
[ INFO] sys_bpf cmd: 2, bpf_attr: 28488, size: 32
[TRACE] bpf map ops fd:1879048194, op:Update key:6f7c value:6f80
[ WARN] convert result get error! ENOENT
test index exceed max_entry
cmd = 3
[ INFO] sys_bpf cmd: 3, bpf_attr: 28488, size: 32
[TRACE] bpf map ops fd:1879048194, op:Delete key:6f7c value:0
[ WARN] convert result get error! EINVAL
test delete index=3, this should fail since you cannot delete an array entry
cmd = 1
[ INFO] sys_bpf cmd: 1, bpf_attr: 28488, size: 32
[TRACE] bpf map ops fd:1879048194, op:LookUp key:6f7c value:6f80
check index=3 again, and we should get a valid value=%ld
bpf array tests PASSED
Start test on bpf hash map, this is a just a test in user space
cmd = 0
[ INFO] sys_bpf cmd: 0, bpf_attr: 28392, size: 32
[TRACE] bpf object create (fd):70000003
bpf hash map with fd: 1879048195 created
put kv: (%lx, %ld)
cmd = 2
[ INFO] sys_bpf cmd: 2, bpf_attr: 28392, size: 32
[TRACE] bpf map ops fd:1879048195, op:Update key:6f30 value:6f38
put kv: (%lx, %ld)
cmd = 2
[ INFO] sys_bpf cmd: 2, bpf_attr: 28392, size: 32
[TRACE] bpf map ops fd:1879048195, op:Update key:6f30 value:6f38
put kv: (%lx, %ld)
cmd = 2
[ INFO] sys_bpf cmd: 2, bpf_attr: 28392, size: 32
[TRACE] bpf map ops fd:1879048195, op:Update key:6f30 value:6f38
put kv: (%lx, %ld)
cmd = 2
[ INFO] sys_bpf cmd: 2, bpf_attr: 28392, size: 32
[TRACE] bpf map ops fd:1879048195, op:Update key:6f30 value:6f38
put kv: (%lx, %ld)
cmd = 2
[ INFO] sys_bpf cmd: 2, bpf_attr: 28392, size: 32
[TRACE] bpf map ops fd:1879048195, op:Update key:6f30 value:6f38
put kv: (%lx, %ld)
cmd = 2
[ INFO] sys_bpf cmd: 2, bpf_attr: 28392, size: 32
[TRACE] bpf map ops fd:1879048195, op:Update key:6f30 value:6f38
put kv: (%lx, %ld)
cmd = 2
[ INFO] sys_bpf cmd: 2, bpf_attr: 28392, size: 32
[TRACE] bpf map ops fd:1879048195, op:Update key:6f30 value:6f38
put kv: (%lx, %ld)
cmd = 2
[ INFO] sys_bpf cmd: 2, bpf_attr: 28392, size: 32
[TRACE] bpf map ops fd:1879048195, op:Update key:6f30 value:6f38
put kv: (%lx, %ld)
cmd = 2
[ INFO] sys_bpf cmd: 2, bpf_attr: 28392, size: 32
[TRACE] bpf map ops fd:1879048195, op:Update key:6f30 value:6f38
put kv: (%lx, %ld)
cmd = 2
[ INFO] sys_bpf cmd: 2, bpf_attr: 28392, size: 32
[TRACE] bpf map ops fd:1879048195, op:Update key:6f30 value:6f38
cmd = 4
[ INFO] sys_bpf cmd: 4, bpf_attr: 28392, size: 32
[TRACE] bpf map ops fd:1879048195, op:GetNextKey key:6f30 value:6f40
cmd = 1
[ INFO] sys_bpf cmd: 1, bpf_attr: 28392, size: 32
[TRACE] bpf map ops fd:1879048195, op:LookUp key:6f30 value:6f38
get kv: (%lx, %ld)
cmd = 4
[ INFO] sys_bpf cmd: 4, bpf_attr: 28392, size: 32
[TRACE] bpf map ops fd:1879048195, op:GetNextKey key:6f30 value:6f40
cmd = 1
[ INFO] sys_bpf cmd: 1, bpf_attr: 28392, size: 32
[TRACE] bpf map ops fd:1879048195, op:LookUp key:6f30 value:6f38
get kv: (%lx, %ld)
cmd = 4
[ INFO] sys_bpf cmd: 4, bpf_attr: 28392, size: 32
[TRACE] bpf map ops fd:1879048195, op:GetNextKey key:6f30 value:6f40
cmd = 1
[ INFO] sys_bpf cmd: 1, bpf_attr: 28392, size: 32
[TRACE] bpf map ops fd:1879048195, op:LookUp key:6f30 value:6f38
get kv: (%lx, %ld)
cmd = 4
[ INFO] sys_bpf cmd: 4, bpf_attr: 28392, size: 32
[TRACE] bpf map ops fd:1879048195, op:GetNextKey key:6f30 value:6f40
cmd = 1
[ INFO] sys_bpf cmd: 1, bpf_attr: 28392, size: 32
[TRACE] bpf map ops fd:1879048195, op:LookUp key:6f30 value:6f38
get kv: (%lx, %ld)
cmd = 4
[ INFO] sys_bpf cmd: 4, bpf_attr: 28392, size: 32
[TRACE] bpf map ops fd:1879048195, op:GetNextKey key:6f30 value:6f40
cmd = 1
[ INFO] sys_bpf cmd: 1, bpf_attr: 28392, size: 32
[TRACE] bpf map ops fd:1879048195, op:LookUp key:6f30 value:6f38
get kv: (%lx, %ld)
cmd = 4
[ INFO] sys_bpf cmd: 4, bpf_attr: 28392, size: 32
[TRACE] bpf map ops fd:1879048195, op:GetNextKey key:6f30 value:6f40
cmd = 1
[ INFO] sys_bpf cmd: 1, bpf_attr: 28392, size: 32
[TRACE] bpf map ops fd:1879048195, op:LookUp key:6f30 value:6f38
get kv: (%lx, %ld)
cmd = 4
[ INFO] sys_bpf cmd: 4, bpf_attr: 28392, size: 32
[TRACE] bpf map ops fd:1879048195, op:GetNextKey key:6f30 value:6f40
cmd = 1
[ INFO] sys_bpf cmd: 1, bpf_attr: 28392, size: 32
[TRACE] bpf map ops fd:1879048195, op:LookUp key:6f30 value:6f38
get kv: (%lx, %ld)
cmd = 4
[ INFO] sys_bpf cmd: 4, bpf_attr: 28392, size: 32
[TRACE] bpf map ops fd:1879048195, op:GetNextKey key:6f30 value:6f40
cmd = 1
[ INFO] sys_bpf cmd: 1, bpf_attr: 28392, size: 32
[TRACE] bpf map ops fd:1879048195, op:LookUp key:6f30 value:6f38
get kv: (%lx, %ld)
cmd = 4
[ INFO] sys_bpf cmd: 4, bpf_attr: 28392, size: 32
[TRACE] bpf map ops fd:1879048195, op:GetNextKey key:6f30 value:6f40
cmd = 1
[ INFO] sys_bpf cmd: 1, bpf_attr: 28392, size: 32
[TRACE] bpf map ops fd:1879048195, op:LookUp key:6f30 value:6f38
get kv: (%lx, %ld)
cmd = 4
[ INFO] sys_bpf cmd: 4, bpf_attr: 28392, size: 32
[TRACE] bpf map ops fd:1879048195, op:GetNextKey key:6f30 value:6f40
cmd = 1
[ INFO] sys_bpf cmd: 1, bpf_attr: 28392, size: 32
[TRACE] bpf map ops fd:1879048195, op:LookUp key:6f30 value:6f38
get kv: (%lx, %ld)
cmd = 4
[ INFO] sys_bpf cmd: 4, bpf_attr: 28392, size: 32
[TRACE] bpf map ops fd:1879048195, op:GetNextKey key:6f30 value:6f40
[ WARN] convert result get error! ENOENT
cmd = 3
[ INFO] sys_bpf cmd: 3, bpf_attr: 28392, size: 32
[TRACE] bpf map ops fd:1879048195, op:Delete key:6f30 value:0
test delete key=%ld
cmd = 1
[ INFO] sys_bpf cmd: 1, bpf_attr: 28392, size: 32
[TRACE] bpf map ops fd:1879048195, op:LookUp key:6f30 value:6f38
[ WARN] convert result get error! ENOENT
try get key=%ld again, this should fail
bpf hashmap tests OK
ALL TEST PASSED!
Shell: Process 2 exited with code 0
>> ebpf_user_maptest
Start test on bpf array map, this is a just a test in user space
cmd = 0
[ INFO] sys_bpf cmd: 0, bpf_attr: 28488, size: 32
[TRACE] bpf object create (fd):70000004
fd is 1879048196
bpf array with fd: 1879048196 created
cmd = 1
[ INFO] sys_bpf cmd: 1, bpf_attr: 28488, size: 32
[TRACE] bpf map ops fd:1879048196, op:LookUp key:6f7c value:6f80
test lookup_elem index=3, get value=%ld
cmd = 2
[ INFO] sys_bpf cmd: 2, bpf_attr: 28488, size: 32
[TRACE] bpf map ops fd:1879048196, op:Update key:6f7c value:6f80
test update_elem index=3 to %ld, and get value=%ld
cmd = 2
[ INFO] sys_bpf cmd: 2, bpf_attr: 28488, size: 32
[TRACE] bpf map ops fd:1879048196, op:Update key:6f7c value:6f80
[ WARN] convert result get error! ENOENT
test index exceed max_entry
cmd = 3
[ INFO] sys_bpf cmd: 3, bpf_attr: 28488, size: 32
[TRACE] bpf map ops fd:1879048196, op:Delete key:6f7c value:0
[ WARN] convert result get error! EINVAL
test delete index=3, this should fail since you cannot delete an array entry
cmd = 1
[ INFO] sys_bpf cmd: 1, bpf_attr: 28488, size: 32
[TRACE] bpf map ops fd:1879048196, op:LookUp key:6f7c value:6f80
check index=3 again, and we should get a valid value=%ld
bpf array tests PASSED
Start test on bpf hash map, this is a just a test in user space
cmd = 0
[ INFO] sys_bpf cmd: 0, bpf_attr: 28392, size: 32
[TRACE] bpf object create (fd):70000005
bpf hash map with fd: 1879048197 created
put kv: (%lx, %ld)
cmd = 2
[ INFO] sys_bpf cmd: 2, bpf_attr: 28392, size: 32
[TRACE] bpf map ops fd:1879048197, op:Update key:6f30 value:6f38
put kv: (%lx, %ld)
cmd = 2
[ INFO] sys_bpf cmd: 2, bpf_attr: 28392, size: 32
[TRACE] bpf map ops fd:1879048197, op:Update key:6f30 value:6f38
put kv: (%lx, %ld)
cmd = 2
[ INFO] sys_bpf cmd: 2, bpf_attr: 28392, size: 32
[TRACE] bpf map ops fd:1879048197, op:Update key:6f30 value:6f38
put kv: (%lx, %ld)
cmd = 2
[ INFO] sys_bpf cmd: 2, bpf_attr: 28392, size: 32
[TRACE] bpf map ops fd:1879048197, op:Update key:6f30 value:6f38
put kv: (%lx, %ld)
cmd = 2
[ INFO] sys_bpf cmd: 2, bpf_attr: 28392, size: 32
[TRACE] bpf map ops fd:1879048197, op:Update key:6f30 value:6f38
put kv: (%lx, %ld)
cmd = 2
[ INFO] sys_bpf cmd: 2, bpf_attr: 28392, size: 32
[TRACE] bpf map ops fd:1879048197, op:Update key:6f30 value:6f38
put kv: (%lx, %ld)
cmd = 2
[ INFO] sys_bpf cmd: 2, bpf_attr: 28392, size: 32
[TRACE] bpf map ops fd:1879048197, op:Update key:6f30 value:6f38
put kv: (%lx, %ld)
cmd = 2
[ INFO] sys_bpf cmd: 2, bpf_attr: 28392, size: 32
[TRACE] bpf map ops fd:1879048197, op:Update key:6f30 value:6f38
put kv: (%lx, %ld)
cmd = 2
[ INFO] sys_bpf cmd: 2, bpf_attr: 28392, size: 32
[TRACE] bpf map ops fd:1879048197, op:Update key:6f30 value:6f38
put kv: (%lx, %ld)
cmd = 2
[ INFO] sys_bpf cmd: 2, bpf_attr: 28392, size: 32
[TRACE] bpf map ops fd:1879048197, op:Update key:6f30 value:6f38
cmd = 4
[ INFO] sys_bpf cmd: 4, bpf_attr: 28392, size: 32
[TRACE] bpf map ops fd:1879048197, op:GetNextKey key:6f30 value:6f40
cmd = 1
[ INFO] sys_bpf cmd: 1, bpf_attr: 28392, size: 32
[TRACE] bpf map ops fd:1879048197, op:LookUp key:6f30 value:6f38
get kv: (%lx, %ld)
cmd = 4
[ INFO] sys_bpf cmd: 4, bpf_attr: 28392, size: 32
[TRACE] bpf map ops fd:1879048197, op:GetNextKey key:6f30 value:6f40
cmd = 1
[ INFO] sys_bpf cmd: 1, bpf_attr: 28392, size: 32
[TRACE] bpf map ops fd:1879048197, op:LookUp key:6f30 value:6f38
get kv: (%lx, %ld)
cmd = 4
[ INFO] sys_bpf cmd: 4, bpf_attr: 28392, size: 32
[TRACE] bpf map ops fd:1879048197, op:GetNextKey key:6f30 value:6f40
cmd = 1
[ INFO] sys_bpf cmd: 1, bpf_attr: 28392, size: 32
[TRACE] bpf map ops fd:1879048197, op:LookUp key:6f30 value:6f38
get kv: (%lx, %ld)
cmd = 4
[ INFO] sys_bpf cmd: 4, bpf_attr: 28392, size: 32
[TRACE] bpf map ops fd:1879048197, op:GetNextKey key:6f30 value:6f40
cmd = 1
[ INFO] sys_bpf cmd: 1, bpf_attr: 28392, size: 32
[TRACE] bpf map ops fd:1879048197, op:LookUp key:6f30 value:6f38
get kv: (%lx, %ld)
cmd = 4
[ INFO] sys_bpf cmd: 4, bpf_attr: 28392, size: 32
[TRACE] bpf map ops fd:1879048197, op:GetNextKey key:6f30 value:6f40
cmd = 1
[ INFO] sys_bpf cmd: 1, bpf_attr: 28392, size: 32
[TRACE] bpf map ops fd:1879048197, op:LookUp key:6f30 value:6f38
get kv: (%lx, %ld)
cmd = 4
[ INFO] sys_bpf cmd: 4, bpf_attr: 28392, size: 32
[TRACE] bpf map ops fd:1879048197, op:GetNextKey key:6f30 value:6f40
cmd = 1
[ INFO] sys_bpf cmd: 1, bpf_attr: 28392, size: 32
[TRACE] bpf map ops fd:1879048197, op:LookUp key:6f30 value:6f38
get kv: (%lx, %ld)
cmd = 4
[ INFO] sys_bpf cmd: 4, bpf_attr: 28392, size: 32
[TRACE] bpf map ops fd:1879048197, op:GetNextKey key:6f30 value:6f40
cmd = 1
[ INFO] sys_bpf cmd: 1, bpf_attr: 28392, size: 32
[TRACE] bpf map ops fd:1879048197, op:LookUp key:6f30 value:6f38
get kv: (%lx, %ld)
cmd = 4
[ INFO] sys_bpf cmd: 4, bpf_attr: 28392, size: 32
[TRACE] bpf map ops fd:1879048197, op:GetNextKey key:6f30 value:6f40
cmd = 1
[ INFO] sys_bpf cmd: 1, bpf_attr: 28392, size: 32
[TRACE] bpf map ops fd:1879048197, op:LookUp key:6f30 value:6f38
get kv: (%lx, %ld)
cmd = 4
[ INFO] sys_bpf cmd: 4, bpf_attr: 28392, size: 32
[TRACE] bpf map ops fd:1879048197, op:GetNextKey key:6f30 value:6f40
cmd = 1
[ INFO] sys_bpf cmd: 1, bpf_attr: 28392, size: 32
[TRACE] bpf map ops fd:1879048197, op:LookUp key:6f30 value:6f38
get kv: (%lx, %ld)
cmd = 4
[ INFO] sys_bpf cmd: 4, bpf_attr: 28392, size: 32
[TRACE] bpf map ops fd:1879048197, op:GetNextKey key:6f30 value:6f40
cmd = 1
[ INFO] sys_bpf cmd: 1, bpf_attr: 28392, size: 32
[TRACE] bpf map ops fd:1879048197, op:LookUp key:6f30 value:6f38
get kv: (%lx, %ld)
cmd = 4
[ INFO] sys_bpf cmd: 4, bpf_attr: 28392, size: 32
[TRACE] bpf map ops fd:1879048197, op:GetNextKey key:6f30 value:6f40
[ WARN] convert result get error! ENOENT
cmd = 3
[ INFO] sys_bpf cmd: 3, bpf_attr: 28392, size: 32
[TRACE] bpf map ops fd:1879048197, op:Delete key:6f30 value:0
test delete key=%ld
cmd = 1
[ INFO] sys_bpf cmd: 1, bpf_attr: 28392, size: 32
[TRACE] bpf map ops fd:1879048197, op:LookUp key:6f30 value:6f38
[ WARN] convert result get error! ENOENT
try get key=%ld again, this should fail
bpf hashmap tests OK
ALL TEST PASSED!
Shell: Process 2 exited with code 0
```

</td> 
<td>

```shell
>> ebpf_user_maptest
Start test on bpf array map, this is a just a test in user space
cmd = 0
fd is 1879048194
bpf array with fd: 1879048194 created
cmd = 1
test lookup_elem index=3, get value=%ld
cmd = 2
test update_elem index=3 to %ld, and get value=%ld
cmd = 2
test index exceed max_entry
cmd = 3
test delete index=3, this should fail since you cannot delete an array entry
cmd = 1
check index=3 again, and we should get a valid value=%ld
bpf array tests PASSED
Start test on bpf hash map, this is a just a test in user space
cmd = 0
bpf hash map with fd: 1879048195 created
put kv: (%lx, %ld)
cmd = 2
put kv: (%lx, %ld)
cmd = 2
put kv: (%lx, %ld)
cmd = 2
put kv: (%lx, %ld)
cmd = 2
put kv: (%lx, %ld)
cmd = 2
put kv: (%lx, %ld)
cmd = 2
put kv: (%lx, %ld)
cmd = 2
put kv: (%lx, %ld)
cmd = 2
put kv: (%lx, %ld)
cmd = 2
put kv: (%lx, %ld)
cmd = 2
cmd = 4
cmd = 1
get kv: (%lx, %ld)
cmd = 4
cmd = 1
get kv: (%lx, %ld)
cmd = 4
cmd = 1
get kv: (%lx, %ld)
cmd = 4
cmd = 1
get kv: (%lx, %ld)
cmd = 4
cmd = 1
get kv: (%lx, %ld)
cmd = 4
cmd = 1
get kv: (%lx, %ld)
cmd = 4
cmd = 1
get kv: (%lx, %ld)
cmd = 4
cmd = 1
get kv: (%lx, %ld)
cmd = 4
cmd = 1
get kv: (%lx, %ld)
cmd = 4
cmd = 1
get kv: (%lx, %ld)
cmd = 4
cmd = 3
test delete key=%ld
cmd = 1
try get key=%ld again, this should fail
bpf hashmap tests OK
ALL TEST PASSED!
```

</td>
</tr>
<tr>
<td>

```shell
>> ebpf_kern_context
[kernel] Exception(InstructionPageFault) in application, bad addr = 0x0, bad instruction = 0x0, core dumped.
Shell: Process 2 exited with code -2
```

</td> <td>

```shell
>> ebpf_kern_context
[kernel] Segmentation Fault, SIGSEGV=11
```

</td>
</tr>
<tr>
<td>

```shell
>> ebpf_user_loadprogextest
ELF content: 464c457f 10102 0 0
cmd = 1000
[ INFO] sys_bpf cmd: 1000, bpf_attr: 36704, size: 32
[TRACE] prog load attr
 prog_base:2d20 prog_size=10576 map_base:8f98 map_num=0
[TRACE] bpf program load ex
[TRACE] symbol table
[ INFO] before compile
[TRACE] bpf object create (fd):70000006
[TRACE] bpf prog loadex finished!
[TRACE] load ex ret: 1879048198
load ex: 70000006
target: kprobe$<linux_syscall::Syscall>::sys_openat len: 43
cmd = 8
[ INFO] sys_bpf cmd: 8, bpf_attr: 36704, size: 32
[TRACE] target name str: kprobe$<linux_syscall::Syscall>::sys_openat
[TRACE] bpf prog attached! tracepoint symbol:<linux_syscall::Syscall>::sys_openat addr: 80217d36
attach: 0
busy loop for 2 times
open called from user
[kernel] breakpoint at 0x80217d36
[ INFO] run attached progs!
bpf prog triggered!
kprobe	addr = 2149678390
vcpu id: 0
pid: 2
print registers
r0  = 11280
r1  = 2149688532
r2  = 10888
r3  = 0
r4  = 1
r5  = 9223372036855301470
r6  = 2149679308
r7  = 36752
r8  = 18446744073709449216
r9  = 8
r10 = 0
r11 = 2
r12 = 2149793704
r13 = 0
r14 = 2
r15 = 0
r16 = 0
r17 = 56
r18 = 0
r19 = 0
r20 = 0
r21 = 0
r22 = 0
r23 = 0
r24 = 0
r25 = 0
r26 = 0
r27 = 0
r28 = 0
r29 = 0
r30 = 0
r31 = 0
[ INFO] run attached progs exit!
[kernel] breakpoint at 0x805e7002
open called from user
[kernel] breakpoint at 0x80217d36
[ INFO] run attached progs!
bpf prog triggered!
kprobe	addr = 2149678390
vcpu id: 0
pid: 2
print registers
r0  = 11280
r1  = 2149688532
r2  = 10888
r3  = 0
r4  = 1
r5  = 9223372036855301470
r6  = 2149679308
r7  = 36752
r8  = 18446744073709449216
r9  = 8
r10 = 0
r11 = 2
r12 = 2149793704
r13 = 0
r14 = 2
r15 = 0
r16 = 36736
r17 = 56
r18 = 0
r19 = 0
r20 = 0
r21 = 0
r22 = 0
r23 = 0
r24 = 0
r25 = 0
r26 = 0
r27 = 0
r28 = 0
r29 = 0
r30 = 0
r31 = 0
[ INFO] run attached progs exit!
[kernel] breakpoint at 0x805e7002
Shell: Process 2 exited with code 0
```

</td> <td>

```shell
>> ebpf_user_loadprogextest
ELF content: 464c457f 10102 0 0
cmd = 1000
load ex: 70000004
target: kprobe$<linux_syscall::Syscall>::sys_openat len: 43
cmd = 8
attach: 0
busy loop for 2 times
open called from user
[kernel] breakpoint at 0x802135f6
bpf prog triggered!
kprobe	addr = 2149660150
vcpu id: 0
pid: 2
print registers
r0  = 18446744073709522424
r1  = 2149701292
r2  = 11318
r3  = 0
r4  = 11288
r5  = 9223372036855304803
r6  = 2149660678
r7  = 36752
r8  = 18446744073709522944
r9  = 8
r10 = 10776
r11 = 0
r12 = 2149852904
r13 = 2
r14 = 1
r15 = 0
r16 = 0
r17 = 56
r18 = 0
r19 = 0
r20 = 0
r21 = 0
r22 = 0
r23 = 0
r24 = 0
r25 = 0
r26 = 0
r27 = 0
r28 = 0
r29 = 0
r30 = 0
r31 = 0
[kernel] breakpoint at 0x816f8002
open called from user
[kernel] breakpoint at 0x802135f6
bpf prog triggered!
kprobe	addr = 2149660150
vcpu id: 0
pid: 2
print registers
r0  = 18446744073709522424
r1  = 2149701292
r2  = 11318
r3  = 0
r4  = 11288
r5  = 9223372036855304803
r6  = 2149660678
r7  = 36752
r8  = 18446744073709522944
r9  = 8
r10 = 10776
r11 = 0
r12 = 2149852904
r13 = 2
r14 = 1
r15 = 0
r16 = 36736
r17 = 56
r18 = 0
r19 = 0
r20 = 0
r21 = 0
r22 = 0
r23 = 0
r24 = 0
r25 = 0
r26 = 0
r27 = 0
r28 = 0
r29 = 0
r30 = 0
r31 = 0
[kernel] breakpoint at 0x816f8002
```

</td>
</tr>
<tr>
<td>

```shell
>> ebpf_user_naivetest
cmd = 0
[ INFO] sys_bpf cmd: 0, bpf_attr: 0, size: 0
[ WARN] convert result get error! EINVAL
Shell: Process 2 exited with code 0
```

</td> <td>

```shell
>> ebpf_user_naivetest
cmd = 0
```

</td>
</tr>
</table>

目前怀疑问题可能出现在 user 模块中，因为 rCore-Tutorial-Code-2022A 和 rCore-Tutorial-v3 的 user 模块
有所不同。

此外，rCore-Tutorial-v3 的中断处理较之前有所变化，也可能导致这些错误。
