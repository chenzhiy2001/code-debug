## 安装与使用

### 一、安装

以下操作在ubuntu环境中进行，推荐使用ubuntu20.04虚拟机，其他版本请确保使用较新的`npm`和`node`。

1. 下载vs code [code-debug 调试插件最新安装包](https://github.com/chenzhiy2001/code-debug/releases)

2. 然后启动 vs code，在扩展视图（Extensions View）中，点击右上角的 **“...”** 菜单，选择 **“从 VSIX 安装...” (Install from VSIX...)**，然后选择第一步下载的 `.vsix` 安装包即可，到这一步调试器插件就可以使用了。

### 二、使用

此处以 rCore-Tutorial-v3 为例进行调试工具的演示。

1. 克隆 rCore-Tutorial-v3 仓库

	```shell
	git clone https://github.com/rcore-os/rCore-Tutorial-v3.git
	```

2. 请根据该[commit](https://github.com/chenzhiy2001/rCore-Tutorial-v3/commit/c64ae25ecee708c0257c9acb9da92309d32e1059)为你本地克隆的rCore打好调试补丁，确保 rCore-Tutorial-v3 能在你的ubuntu本地运行起来，运行方法参考 rCore 仓库Readme文件
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

### 三、开发环境配置
如果你想要开发我们的调试器，请确保以下依赖安装好：

	```shell
	# 使用命令检查是否安装成功：
	npm -v  (版本在9以上)
	node -v (版本在18以上)
	```
如果上方所需依赖环境中不存在，请按以下提示进行安装：

	```shell
	# npm安装，尽量安装较新的版本
	curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
	sudo apt-get install -y nodejs
	#查看版本信息
	node --version
	npm --version
	```

环境配置好后，克隆我们的仓库链接，即可进行开发。

   
