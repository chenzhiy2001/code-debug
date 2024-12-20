## 安装与使用

### 安装-方法1-自动配置脚本

#### 请保证磁盘空间足够大（建议70G）

#### 安装Ubuntu

[解决安装Ubuntu找不到“继续”按钮的问题](https://blog.csdn.net/weixin_54630384/article/details/127767424?spm=1001.2101.3001.6650.7&utm_medium=distribute.pc_relevant.none-task-blog-2%7Edefault%7EBlogCommendFromBaidu%7ERate-7-127767424-blog-120077249.235%5Ev38%5Epc_relevant_anti_vip_base&depth_1-utm_source=distribute.pc_relevant.none-task-blog-2%7Edefault%7EBlogCommendFromBaidu%7ERate-7-127767424-blog-120077249.235%5Ev38%5Epc_relevant_anti_vip_base&utm_relevant_index=8)

[vmware和主机间复制粘贴文件、文字_](https://blog.csdn.net/stanlyYP/article/details/127107448)

[ubuntu中文输入法无法打中文的解决办法](https://blog.csdn.net/qq_39810051/article/details/131981407)

[VMware共享文件夹设置](https://blog.csdn.net/weixin_54051652/article/details/128316296)

#### 下载仓库

```plain
git clone https://github.com/chenzhiy2001/code-debug
git clone --recursive https://github.com/chenzhiy2001/rcore-ebpf
```
注：rcore-ebpf 为修改版的 rCore-Tutorial-v3
#### 配置环境

1. 将**安装与使用**文件夹中的test.sh换到在`/home/你的用户名`目录下运行
2. 执行chmod +x test.sh命令，为文件添加权限
3. 执行./test.sh，开始执行，请保证网络畅通，可能要很长时间(期间若遇到某个部分无法安装的问题，采用手动安装再继续）
4. 执行完毕后配置环境变量：
```plain
vim ~/.bashrc
在.bashrc最后面添加以下语句
export PATH=$PATH:/home/zly/qemu-system-riscv64/build
export PATH=$PATH:/opt/riscv/bin
退出
source ~/.bashrc
```
5. 使用命令检查是否安装成功：
    1. rustc --version   (rustc 1.74.0-nightly (59a829484 2023-08-30))
    2. npm -v  (版本在9以上)
    3. node -v (版本在18以上)
    4. qemu-system-riscv64 --version  （QEMU emulator version 7.0.0）
    5. /opt/riscv/bin/riscv64-unknown-elf-gdb  （出现（gdb命令行，输入以下命令，有输出的话，表示有python支持））
```plain
(gdb) python
print("114514")
end 
```
6. 如果还有问题请查看test.sh文件，里面用回车符隔开了下载各个工具的命令，可以把它单独复制出来到新的文件重新运行
   
#### 安装vscode

1. [Download Visual Studio Code - Mac, Linux, Windows](https://code.visualstudio.com/Download)下载.deb
2. 执行下面命令，注意换文件名
```plain
 sudo dpkg -i code_1.71.2-1663191218_amd64.deb
```

#### 编译rcore-ebpf
* 在[安装说明](https://github.com/chenzhiy2001/code-debug/tree/master/%E5%AE%89%E8%A3%85%E8%AF%B4%E6%98%8E)中找到相应配置文件并添加
* 修改user/ebpf/build.sh里的路径
* 在 os 中 make run
* 如果遇到需要更高的nightly版本但是更新后仍出现此错误
在rust-toolchain.toml中将channel改为更新后的版本
* 如果在编译过程中遇到“找不到clang-12”报错，执行下面命令
```plain
sudo apt-get install clang-12
```
* 安装cmake 命令：
```plain
sudo apt-get install cmake
```
* 如果遇到“ riscv64-linux-musl-gcc未找到”
在musl.cc下载 riscv64-linux-musl-cross.tgz 并解压到主目录，将riscv64-linux-musl-cross/bin 加入环境变量：
```plain
export PATH=$PATH:/home/path/to/riscv64-linux-musl-cross/bin
```

### 安装-方法2-手动安装

#### 环境配置

流程略长，如果出现问题欢迎提issue.

1. 推荐用ubuntu20.04虚拟机。其它版本请确保使用较新的`npm`和`node`。

1. 安装 vscode（Ubuntu中下载的vscode不能输入中文，可以参考[这篇文章](https://blog.csdn.net/mantou_riji/article/details/123379045?utm_medium=distribute.pc_aggpage_search_result.none-task-blog-2~aggregatepage~first_rank_ecpm_v1~rank_v31_ecpm-1-123379045-null-null.pc_agg_new_rank&utm_term=vscode%E8%BE%93%E5%85%A5%E4%B8%8D%E4%BA%86%E4%B8%AD%E6%96%87&spm=1000.2123.3001.4430)）

1. Rust 开发环境配置，qemu安装，可以参考[rCore指导书](https://rcore-os.github.io/rCore-Tutorial-Book-v3/chapter0/5setup-devel-env.html)，也可以使用下面命令直接安装

   ```
   Rust 开发环境配置主要步骤如下：
   sudo apt install curl //要用apt安装curl
   curl https://sh.rustup.rs -sSf | sh
   source $HOME/.cargo/env
   rustup install nightly
   rustup default nightly
   
   qemu安装
   # 安装编译所需的依赖包
   sudo apt install autoconf automake autotools-dev curl libmpc-dev libmpfr-dev libgmp-dev \
                 gawk build-essential bison flex texinfo gperf libtool patchutils bc \
                 zlib1g-dev libexpat-dev pkg-config  libglib2.0-dev libpixman-1-dev libsdl2-dev \
                 git tmux python3 python3-pip ninja-build coreutils xautomation xdotool
   # 下载源码包
   # 如果下载速度过慢可以使用我们提供的百度网盘链接：https://pan.baidu.com/s/1dykndFzY73nqkPL2QXs32Q
   # 提取码：jimc
   wget https://download.qemu.org/qemu-7.0.0.tar.xz
   # 解压
   tar xvJf qemu-7.0.0.tar.xz
   # 编译安装并配置 RISC-V 支持
   
   cd qemu-7.0.0

   ./configure --target-list=riscv64-softmmu,riscv64-linux-user  # 如果要支持图形界面，可添加 " --enable-sdl" 参数

   make -j$(nproc)
   
   #配置qemu环境变量：
   #编辑~/.bashrc文件，在最后一行添加下面语句：
   export PATH=$PATH:/path/to/qemu-7.0.0/build
   # 注意，执行以上操作时，不能直接复制粘贴,要把/path/to改成qemu所在的文件夹。
   # 另外，执行完以上操作后，要重启终端才能成功添加环境变量。若配置qemu失败，不妨输入$PATH查看环境变量有没有正确添加。

   
   #此时我们可以确认 QEMU 的版本：
   qemu-system-riscv64 --version
   qemu-riscv64 --version
   ```

1. npm安装，尽量安装较新的版本

   ```
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   #查看版本信息
   node --version
   npm --version
   ```

1. 获取risc-v工具链 在[sifive官网](https://www.sifive.com/software)下载risc-v工具链或者试试直接访问[这里](https://static.dev.sifive.com/dev-tools/riscv64-unknown-elf-gcc-8.3.0-2020.04.1-x86_64-linux-ubuntu14.tar.gz)。下载后将该文件复制到`/home/你的用户名`目录下并解压，将其中的bin/文件夹加入环境变量.

    > Sifive官网提供的工具链没有python支持，因此，如果想用ebpf side-stub，我们要自己编译一份工具链：(更多信息见<https://github.com/riscv-collab/riscv-gnu-toolchain/issues/925>)
    > 
    > 确保有 15GiB 剩余硬盘空间
    > 
    > `sudo apt install python-is-python3`
    > 
    > `sudo apt-get install autoconf automake autotools-dev curl python3 libmpc-dev libmpfr-dev libgmp-dev gawk build-essential bison flex texinfo gperf libtool patchutils bc zlib1g-dev libexpat-dev ninja-build`
    > 
    > `sudo apt install python3-dev`
    > 
    > `git clone https://github.com/riscv/riscv-gnu-toolchain`
    > 
    > `cd riscv-gnu-toolchain`
    > 
    > `./configure --prefix=/opt/riscv`
    > 
    > `sudo make`
    > 
    > 就可以自动下载、编译。编译完成后，
    >
    > `/opt/riscv/bin/riscv64-unknown-elf-gdb`
    > 
    > `(gdb) python`
    > 
    >  `print("114514")`
    > 
    >  `end`
    >
    > 如果gdb输出`114514`就表示有python支持。
    > 
    > 最后将`/opt/riscv/bin`加入PATH。如果之前将sifive提供的工具链也加入了PATH，应该要把它去掉。
    >
    > 如果你的python没有pyserial模块，应该安装一下：
    > 
    > `pip3 install pyserial`
    >
    > 如果想用venv, 可以参考[这篇文章](https://interrupt.memfault.com/blog/using-pypi-packages-with-gdb)。



1. 下载rcore-ebpf，需要修改rcore-ebpf的源码和编译参数，下载[这个仓库](https://github.com/chenzhiy2001/rCore-Tutorial-v3)修改过的rCore-Tutorial-v3，建议下载到`/home/你的用户名`，下载之后跑一遍rcore-ebpf。


1. clone 本仓库(code-debug)，建议clone到`/home/你的用户名`

#### 待调试OS的配置

1. 在仓库目录下(.../code-debug)运行 npm install 命令

1. 在vscode中打开本项目，按F5执行，会弹出一个新的窗口

1. 在新窗口中打开rcore-ebpf项目，在 .vscode 文件夹中添加 launch.json文件，并输入以下内容，然后保存并再编译一遍rCore，接着在新窗口内按F5就可以启动gdb并调试。

   如果GDB并没有正常启动，可以尝试把下面的gdbpath改成绝对路径(如“/home/username/riscv64-unknown-elf-toolchain-10.2.0-2020.12.8-x86_64-linux-ubuntu14/bin”)。

    - 这里解释一下`KERNEL_IN_BREAKPOINTS_LINE`和`GO_TO_KERNEL_LINE`的区别。以rCore-Tutorial-v3为例，`KERNEL_IN_BREAKPOINTS_LINE`对应`trap_return`函数的断点，而`GO_TO_KERNEL_LINE`对应`trap_return`函数调用的`set_user_trap_entry`子函数的断点。而`set_user_trap_entry`子函数实际上只有一行语句：`stvec::write(TRAMPOLINE as usize, TrapMode::Direct);`。也就是说，`KERNEL_IN_BREAKPOINTS_LINE`指向中断处理例程，而`GO_TO_KERNEL_LINE`精确地指向中断处理例程中的`stvec::write(TRAMPOLINE as usize, TrapMode::Direct);`语句。
1. 为了用eBPF Panel，需要在rCore-Tutorial-v3的根目录下添加一个脚本：

```shell
tty > ./qemu_tty
qemu-system-riscv64 "$@" | tee ./code_debug_qemu_output_history.txt
```
将这个脚本命名为`qemu-system-riscv64-with-logs.sh`，添加可执行权限（`chmod +x qemu-system-riscv64-with-logs.sh`），然后将刚才launch.json中的`"qemuPath": "qemu-system-riscv64"`改为`"qemuPath": "${workspaceRoot}/qemu-system-riscv64-with-logs.sh"`.

1. （可选）如果你要用rust-gdb，先保证你的GDB有Python支持（前文有介绍怎么添加Python支持）然后在rCore-Tutorial-v3的根目录下添加一个脚本：
```shell
export RUST_GDB=riscv64-unknown-elf-gdb
rust-gdb "$@"
```
将这个脚本命名为`riscv64-unknown-elf-gdb-rust.sh`，添加可执行权限，然后将刚才launch.json中的`"gdbpath": "riscv64-unknown-elf-gdb"`改为
`"gdbpath": "${workspaceRoot}/riscv64-unknown-elf-gdb-rust.sh"`.

`RUST_GDB=riscv64-unknown-elf-gdb`（一种方法是，在~/.bashrc里添加一行`export RUST_GDB=riscv64-unknown-elf-gdb`）然后将launch.json里的gdbpath改为`rust-gdb`.
