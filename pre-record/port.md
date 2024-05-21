## 必须的依赖

1. ebpf 支持
1. 符号表
1. risc-v 工具链提供的 gdb

## 配置

1. launch.json
1. `code-debug/src/frontend/extension.ts` 硬编码的用户程序名，硬编码的 rCore 位置
   1. 15 行 initproc 改成 ch9b_initproc
   2. 16 行改成您要 debug 的 rCore 的位置，比如 os.homedir() + "/rCore-Tutorial-Code-2023S"
1. `code-debug/src/mibase.ts` 硬编码的行号
   1. 1255 行，65 改成 79
   2. 1264 行和 343 行，135 改成 148
   3. 1281 行，30 改成 43
1. 改内核编译参数
1. code-debug/src/frontend/extension.ts 中的 16 行改成您要 debug 的 rCore 的位置，比如
   os.homedir() + "/rCore-Tutorial-Code-2023S"
