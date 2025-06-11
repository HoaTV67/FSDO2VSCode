SetTitleMatchMode, 2
DetectHiddenWindows, On

; ✅ TEST 1: Mở Start Menu
Send, ^{Esc} ; 🧪 Test: mở Start Menu nếu AHK thực sự chạy
Sleep 1000

; ✅ TEST 2: Popup confirm
TrayTip, 🟢 AHK Active, Script đã chạy thành công!, 3

; ✅ TEST 3: Ghi log
log := A_Temp . "\\ahk-debug.txt"
FileAppend, [%A_Now%] AHK đã chạy!`n, %log%

; ✅ TEST 4: Mở Notepad nếu cần xác nhận cứng
; Run, notepad.exe ; (có thể tạm bỏ comment để test trực quan)

; 🔽 Đọc file cấu hình
file := A_Temp . "\\sql-connect-info.txt"
if !FileExist(file) {
    MsgBox, File not found: %file%
    ExitApp
}

Loop, Read, %file%
{
    if (RegExMatch(A_LoopReadLine, "i)^Server=(.*)", m)) server := m1
    else if (RegExMatch(A_LoopReadLine, "i)^Database=(.*)", m)) db := m1
    else if (RegExMatch(A_LoopReadLine, "i)^Uid=(.*)", m)) uid := m1
    else if (RegExMatch(A_LoopReadLine, "i)^Pwd=(.*)", m)) pwd := m1
}

; Nếu SSMS đã mở → gửi Alt+C để mở dialog connect
IfWinExist, SQL Server Management Studio
{
    WinActivate
    Sleep 1000
    Send, !c
}

WinWaitActive, Connect to Server
Sleep 1500

; Di chuyển đến Authentication và chọn đúng
Send, {Tab} ; Server type → Server name
Sleep 100
Send, {Tab} ; Server name → Authentication
Sleep 100
Send, {Down} ; Chọn SQL Server Authentication

Sleep 300
Send, {Tab} ; Login
Sleep 200
Send, %uid%
Sleep 200
Send, {Tab}
Sleep 200
Send, %pwd%
Sleep 200
Send, {Enter}
