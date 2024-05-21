## 内存查看、编辑功能实现说明

目前，调试工具已经支持使用微软官方的 HexEdit 插件对内存指定地址数据进行显示和编辑，本文档主要介绍实
现该功能的原理，以方便后续维护和升级。

## 之前内存访问的方式

在本项目的 upstream 仓库中，已经具备了在调试插件中查看内存数据的功能，但在该功能实现时，DAP 中并没有
关于内存读写的相关协议存在，因此使用了一个绕弯的方式来实现该功能，及 DebugAdapter 进程中启动了一个本
地的 socket 服务器，在 Extension 进程中连接该服务器，相当于在 DAP 本身的 RPC 之外，又开辟了一条独立
的 RPC 信道。通过这条新的信道，可以实现内存数据读取的功能，读取到的数据通过一个自定义的
ContentProvider 进行数据格式化，然后显示在窗口中。

该实现有如下问题：

- 使用了一个独立的 Socket，增加了程序的复杂性，同时还需要用户选择不同会话之间对应的 Socket 连接，易
  用性很差。
- 仅支持内存查看，不支持实时修改

## 开源社区已有的前置工作

### Debug Apapter Protocol 引入

DAP 的 1.35 版本，引入了 readMemory 请求，在 1.48 版本引入了 writeMemory 请求。这两个请求使得通过标
准 DAP 协议进行内存读取和修改成为了可能。

### VSCode 支持 DAP 的 readMemory、writeMemory 请求

在 https://github.com/microsoft/vscode/pull/133643 这个 PR 中，VSCode 引入了对内存操作的支持，重点如
下：

- 定义了新的 schema`vscode-debug-memory`,并且将其关联到一个实现了虚拟文件系统接口的
  类`DebugMemoryFileSystemProvider`上。

  - 这也就意味着，如果打开一个 URL 以`vscode-debug-memory://`开头的文档，那么 VSCode 会调
    用`DebugMemoryFileSystemProvider`这个虚拟文件系统类来提供要显示的文件的内容。这个虚拟文件系统会
    解析文件 URL 中的其他参数（比如要访问的内存地址、读取数据的长度等等），创建出一个虚拟的文件描述
    符，并将文件的 read 请求自动翻译成 DAP 中的 readMemory 请求,将文件的 write 请求自动翻译为 DAP 协
    议中的 writeMemory 请求。

- 通过调用微软自己开发的另一款名为 HexEdit 的插件，来实现对内存的查看和编辑。
  - 具体来说，这个版本的 VSCode 引入了在调试模式界面下，在变量列表窗口中，每个变量的后面会出现一个查
    看内存数据的小图标，点击某个变量后面的这个小图标时，VSCode 就会自动调用 HexEdit 插件来打开该变量
    内存所在地址的虚拟文件，这样就可以在 HexEdit 中查看编辑了。

### 微软的 HexEdit 插件

这是微软提供的一个十六进制查看、编辑的插件，可以以 16 进制和 ASCII 视图打开一个文件并进行编辑。

上面提到了，由于这个插件是微软官方开发的，和 VSCode 本身的代码联系还是很紧密的，因此这个插件里面包含
针对 memory debug 的特殊支持, 引入这些特殊支持的提交是
：https://github.com/microsoft/vscode-hexeditor/commit/5f742bd946356718de41aacd3d6ac00e15a0cb85

## 我的工作

1. 梳理清楚了上述各个前置工作之间的关联关系

1. 在`mibase.ts`中实现了`readMemoryRequest` 和 `writeMemoryRequest`两个方法的实现，将 DAP 的请求翻译
   成 GDB 的对应指令。

1. 删除了上游仓库中陈旧的实现方式，完全迁移到标准的 DAP 协议上，精简了代码

1. 修改`code-debug.examineMemoryLocation`命令的实现逻辑，由用户输入需要查看的内存地址范围以后，自动
   调用 HexEdit 插件来显示或编辑内存数据

## 后续展望

- 目前，HexEdit 还是一个独立的插件，这个插件所提供的十六进制编辑视图本身并没有集成到 VSCode 中，但是
  社区也在讨论后续是否会将这个视图内置到 VSCode 中。这个点可以跟进关注

  - 在融合到 VSCode 之前，我们的插件如果想使用内存查看、编辑功能，就必须首先安装好 HexEdit 插件，可
    以引入自动检测功能，如果发现当前还没有安装 HexEdit 插件，那么提示用户安装。

- 由于我们目前的插件还不支持在调试窗口的 TreeView 中显示本地变量等，因此也就没有办法使用 VSCode 本身
  已经集成的查看变量内存的功能。期望在后续把 WebView 完全替换成 TreeView 以后，就可以多一种查看内存
  的操作入口。

- 目前，虚拟文件系统和 HexEdit 之间对异常的传递不是很友好，如果 GDB 在读取内存过程中发生错误，这个错
  误不能经由虚拟文件系统传递给 HexEdit，这会导致当底层发生错误时，HexEdit 窗口无法体现出错情况。
