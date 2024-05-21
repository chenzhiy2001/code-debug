# 怎么保留进程的名字信息

ProcessControlBlock 有四个函数： new() 用于创建 initproc. 此处的修改很简单： fork() 用于 fork. 这个
也很简单，fork 的时候添加一个参数就行。因为 fork 前后，名字是保持不变的。如果 fork 后再 exec 情况就
不一样了。具体可以看下一节。： exec() 略微复杂。首先我们要明白 exec()干什么： In computing, exec is
a functionality of an operating system that runs an executable file in the context of an already
existing process, replacing the previous executable. This act is also referred to as an overlay. 也
就是说， exec() 覆盖了现有的资源，不会创造新的进程控制块。因此，在 exec()中，我们直接更改当前进程的
path 信息：

下面这个是错误的结论。exec()如果成功执行的话，是不会返回的。initproc.rs 里面有两个 exec()是因为，如
果第一个执行失败了，还有第二个 exec 兜底。代码： ~~此外还有个容易忽略的地方：exec()函数会返回到原来
的函数继续执行，因此，我们要在“返回到原来的函数继续执行”这个流程中，恢复 exec()前的 path. 否则，在调
用 exec()后 path 就不正确了，这是一个容易忽略的地方。查 rCore-Tutorial-v3 文档得到函数是 （注意这个
不是调度用的那个 idle 函数）:~~

我发现一边写代码一边写文档效率是比较高的。如果事后写文档的话，回忆起来很累，而且回忆得不完整。
