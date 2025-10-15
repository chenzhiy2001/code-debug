## 安装与使用

### 一、安装与环境配置

以下操作在ubuntu环境中进行，推荐使用ubuntu20.04虚拟机，其他版本请确保使用较新的`npm`和`node`。

1. 下载vs code [code-debug 调试插件最新安装包](https://github.com/chenzhiy2001/code-debug/releases)

2. 然后启动 vs code，在扩展视图（Extensions View）中，点击右上角的 **“...”** 菜单，选择 **“从 VSIX 安装...” (Install from VSIX...)**，然后选择第一步下载的 `.vsix` 安装包即可

3. 请确保以下依赖安装好：

	```shell
	# 使用命令检查是否安装成功：
	rustc --version   (rustc 1.74.0-nightly (59a829484 2023-08-30))
	npm -v  (版本在9以上)
	node -v (版本在18以上)
	qemu-system-riscv64 --version  （QEMU emulator version 7.0.0）
	```

4. 如果上方所需依赖环境中不存在，请按以下提示进行安装：

	```shell
	# 一、Rust 开发环境配置主要步骤如下：
	sudo apt install curl //要用apt安装curl
	curl https://sh.rustup.rs -sSf | sh
	source $HOME/.cargo/env
	rustup install nightly
	rustup default nightly
	
	
	# 二、qemu安装
	# 1. 安装编译所需的依赖包
	sudo apt install autoconf automake autotools-dev curl libmpc-dev libmpfr-dev libgmp-dev \
	              gawk build-essential bison flex texinfo gperf libtool patchutils bc \
	              zlib1g-dev libexpat-dev pkg-config  libglib2.0-dev libpixman-1-dev libsdl2-dev \
	              git tmux python3 python3-pip ninja-build coreutils xautomation xdotool
	# 2. 下载源码包
	# 如果下载速度过慢可以使用我们提供的百度网盘链接：https://pan.baidu.com/s/1dykndFzY73nqkPL2QXs32Q
	# 提取码：jimc
	wget https://download.qemu.org/qemu-7.0.0.tar.xz
	# 解压
	tar xvJf qemu-7.0.0.tar.xz
	
	# 3. 编译安装并配置 RISC-V 支持
	cd qemu-7.0.0
	
	./configure --target-list=riscv64-softmmu,riscv64-linux-user  # 如果要支持图形界面，可添加 " --enable-sdl" 参数
	
	make -j$(nproc)
	
	# 4. 配置qemu环境变量：
	# 编辑 ~/.bashrc 文件，在最后一行添加下面语句：
	export PATH=$PATH:/path/to/qemu-7.0.0/build
	# 注意，执行以上操作时，不能直接复制粘贴，要把 /path/to 改成qemu所在的目录。
	# 另外，执行完以上操作后，要重启终端才能成功添加环境变量。若配置qemu失败，不妨输入 $PATH 查看环境变量有没有正确添加。
	
	# 5. 此时我们可以确认 QEMU 的版本：
	qemu-system-riscv64 --version
	qemu-riscv64 --version
	
	
	# 三、npm安装，尽量安装较新的版本
	curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
	sudo apt-get install -y nodejs
	#查看版本信息
	node --version
	npm --version
	```

5. 安装编译 risc-v工具链 

	在[sifive官网](https://www.sifive.com/software)下载risc-v工具链没有python支持。因此，如果想用ebpf side-stub，我们要自己编译一份工具链：

	(更多信息见<https://github.com/riscv-collab/riscv-gnu-toolchain/issues/925>)

	```shell
	# 确保有足够的硬盘空间
	sudo apt install python-is-python3
	
	sudo apt-get install autoconf automake autotools-dev curl python3 libmpc-dev libmpfr-dev libgmp-dev gawk build-essential bison flex texinfo gperf libtool patchutils bc zlib1g-dev libexpat-dev ninja-build
	
	sudo apt install python3-dev
	
	git clone https://github.com/riscv/riscv-gnu-toolchain
	
	cd riscv-gnu-toolchain
	
	./configure --prefix=/opt/riscv
	
	sudo make
	```

	编译完成后，输入：`/opt/riscv/bin/riscv64-unknown-elf-gdb`

	（出现gdb命令行，输入以下命令，有输出的话，表示有python支持）

	```shell
	(gdb) python
	print("114514")
	end 
	```

	如果gdb输出`114514`就表示有python支持。

	最后将`/opt/riscv/bin`加入PATH。如果之前将sifive提供的工具链也加入了PATH，应该要把它去掉。

	> 如果你的python没有pyserial模块，应该安装一下：
	>
	> `pip3 install pyserial`
	>
	> 如果想用venv, 可以参考[这篇文章](https://interrupt.memfault.com/blog/using-pypi-packages-with-gdb)。

到这里，调试环境就配置好了。



### 二、使用

此处以 rCore-Tutorial-v3 为例进行调试工具的演示。

1. 克隆 rCore-Tutorial-v3 仓库

	```shell
	git clone https://github.com/rcore-os/rCore-Tutorial-v3.git
	```

2. 请确保 rCore-Tutorial-v3 能在你的ubuntu本地运行起来，运行方法参考 rCore 仓库Readme文件
3. 打开vs code，并打开被调试的 rCore-Tutorial-v3 文件夹，在 .vscode 文件夹中创建 launch.json 文件，并添加[该文件](https://github.com/chenzhiy2001/code-debug/blob/c102c48714221e5a38d28a54289080fff7ca0892/installation%20and%20usage/ebpf_launch.json)中内容
4. 为了用eBPF Panel，需要在 rCore-Tutorial-v3 的根目录下添加一个脚本 qemu-system-riscv64-with-logs.sh ，内容如下：

```shell
tty > ./qemu_tty
qemu-system-riscv64 "$@" | tee ./code_debug_qemu_output_history.txt
```

保存并添加可执行权限`chmod +x qemu-system-riscv64-with-logs.sh`，然后再编译一遍 rCore。

5. 启动调试：在vs code 的 rCore 窗口下按 F5 启动调试即可。

 NOTE：此处是[演示视频](https://gitlab.eduxiji.net/T202410011992734/project2210132-235708/-/blob/master/installation%20and%20usage/%E6%BC%94%E7%A4%BA%E8%A7%86%E9%A2%91.mp4)（该视频是使用仓库代码启动的调试器，如果使用vs code code-debug 插件，即可直接按照上面的方法启动调试）


6. （可选）如果你要用rust-gdb，先保证你的GDB有Python支持（前文有介绍怎么添加Python支持）然后在rCore-Tutorial-v3的根目录下添加一个脚本：

```shell
export RUST_GDB=riscv64-unknown-elf-gdb
rust-gdb "$@"
```

将这个脚本命名为`riscv64-unknown-elf-gdb-rust.sh`，添加可执行权限，然后将刚才launch.json中的`"gdbpath": "riscv64-unknown-elf-gdb"`改为`"gdbpath": "${workspaceRoot}/riscv64-unknown-elf-gdb-rust.sh"`

**NOTE: 我们还提供了 [uCore](https://github.com/kiukotsu/ucore)、[xv6](https://github.com/michaelengel/xv6-vf2) 的调试配置文件，均在[该目录](https://github.com/chenzhiy2001/code-debug/tree/master/installation%20and%20usage)下，使用方法与 rCore 一致，保证被调试系统能够正常运行，然后添加对应的vs code配置文件，再进行第5步 启动调试，即可。值得提示的是，uCore的调试单位为一个lab，在启动调试后，vs code会提醒您选择需要调试的lab，如果您要调试lab8，需要根据配置文件中的注释，对配置文件进行稍微的调整。**

### 补充：三、自动配置环境方法
为了便于用户，我们还提供了从零开始的环境配置脚本。

克隆仓库
```plain
git clone https://github.com/chenzhiy2001/code-debug
```

#### 配置环境

1. 将**installation and usage**文件夹中的test.sh换到在`/home/你的用户名`目录下运行
2. 执行chmod +x test.sh命令，为文件添加权限
3. 执行./test.sh，开始执行，请保证网络畅通，可能要很长时间(期间若遇到某个部分无法安装的问题，采用手动安装再继续）
4. 执行完毕后配置环境变量：
```plain
vim ~/.bashrc
# 在.bashrc最后面添加以下语句
export PATH=$PATH:/home/zly/qemu-system-riscv64/build
export PATH=$PATH:/opt/riscv/bin
# 退出
source ~/.bashrc
```
5. 使用命令检查是否安装成功：
```plain
1. rustc --version   (rustc 1.74.0-nightly (59a829484 2023-08-30))
2. npm -v  (版本在9以上)
3. node -v (版本在18以上)
4. qemu-system-riscv64 --version  （QEMU emulator version 7.0.0）
5. /opt/riscv/bin/riscv64-unknown-elf-gdb  （出现gdb命令行，输入以下命令，有输出的话，表示有python支持）
(gdb) python
print("114514")
end 
```

6. 如果还有问题请查看test.sh文件，里面用回车符隔开了下载各个工具的命令，可以把它单独复制出来到新的文件重新运行

   
