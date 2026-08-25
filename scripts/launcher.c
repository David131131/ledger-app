/*
 * 做账.app 的原生启动器（Mach-O 可执行文件）。
 * macOS 的 LaunchServices 对纯脚本型 .app 支持不可靠，
 * 因此这里用真正的二进制来启动 Electron。
 * 用法：clang -O2 -o launcher launcher.c
 */
#include <unistd.h>
#include <stdio.h>
#include <errno.h>
#include <string.h>

int main(int argc, char **argv) {
    (void)argc;
    (void)argv;
    const char *electron =
        "/Users/daifengyuan/Desktop/My Programs/做账/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron";
    const char *appdir = "/Users/daifengyuan/Desktop/My Programs/做账";
    char *args[] = {(char *)electron, (char *)appdir, NULL};
    execv(electron, args);
    fprintf(stderr, "launcher: execv failed: %s\n", strerror(errno));
    return 1;
}
