## 参考对象

[Cortex-Debug](https://github.com/Marus/cortex-debug) 是一个 VSCode 的 OpenOCD 调试插件，它和我们这
个插件一样，都是由 [WebFreak001/code-debug](https://github.com/WebFreak001/code-debug) 修改而来的。
所以其中很多代码和我们的是相似的

## 移植思路

1. launch.json 里面的 qemu 启动参数改成启动 openocd 的
2. 找到 Alien OS 的 trap_handler，修改之前折腾的那三个行号
3. 找到这个 OS 的存放用户应用程序的位置，然后再略微修改源代码里面相关的部分（extension.ts 或
   mibase.ts），最好直接把可以提取的参数给提取出来到 launch.json 里

## 资料

<https://engr523.github.io/gdb_instructions.html>
<https://github.com/riscv/riscv-openocd/issues/500>
