; 做账 Windows 安装器自定义脚本
; 1) 默认安装目录改为 ASCII 路径（避免中文路径在某些环境下出问题）

!macro customInit
  StrCpy $INSTDIR "$LOCALAPPDATA\Programs\zuozhang"
!macroend
