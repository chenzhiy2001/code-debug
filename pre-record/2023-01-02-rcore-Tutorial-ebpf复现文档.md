# musl 环境变量

> You may need to install toolchains from musl.cc ... and add them to your PATH. 这一步可能写详细一
> 点比较好，像这样:

下载 `riscv64-linux-musl-cross.tgz` 并解压，将`riscv64-linux-musl-cross/bin` 加入环境变量

# cc 相关错误

cmake 报错/usr/bin/cc 无法编译一个测试程序。运行的时候将 CC 变量指向`riscv64-linux-musl-gcc` 即可：

`CC=riscv64-linux-musl-gcc make run`

# #![feature(map_first_last)]

依照编译器提示修改之后即可顺利运行

```plain
error[E0658]: use of unstable library feature 'map_first_last'
  --> src/probe/arch/riscv/breakpoint.rs:44:29
   |
44 |         let addr = free_bps.pop_first().unwrap();
   |                             ^^^^^^^^^
   |
   = note: see issue #62924 <https://github.com/rust-lang/rust/issues/62924> for more information
   = help: add `#![feature(map_first_last)]` to the crate attributes to enable
```
