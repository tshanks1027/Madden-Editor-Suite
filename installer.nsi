; Madden Editor Suite - NSIS Installer Script
; Professional installer with branding and directory selection
; Enhanced with anti-virus false positive reduction

!include "MUI2.nsh"
!include "FileFunc.nsh"
!include "LogicLib.nsh"

; Product Information
!define PRODUCT_NAME "Madden Editor Suite"
!define PRODUCT_VERSION "1.9.0"
!define PRODUCT_PUBLISHER "KRaZyNuttZ"
!define PRODUCT_WEB_SITE "https://github.com/tshanks1027"
!define PRODUCT_UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}"
!define PRODUCT_UNINST_ROOT_KEY "HKLM"

; Anti-virus false positive reduction
Unicode true
ManifestSupportedOS all
SetCompressor /SOLID lzma
SetCompressorDictSize 32

; General Settings
Name "${PRODUCT_NAME} ${PRODUCT_VERSION}"
OutFile "dist\Madden-Editor-Suite-Setup.exe"
InstallDir "$PROGRAMFILES64\MaddenEditorSuite"
InstallDirRegKey HKLM "Software\${PRODUCT_PUBLISHER}\${PRODUCT_NAME}" ""
ShowInstDetails show
ShowUnInstDetails show
RequestExecutionLevel admin

; Branding
!define MUI_ICON "..\Branding\madden.ico"
!define MUI_UNICON "..\Branding\madden.ico"

; Interface Settings
!define MUI_ABORTWARNING

; Pages
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_RUN "$INSTDIR\madden-editor-suite.exe"
!insertmacro MUI_PAGE_FINISH

; Uninstaller Pages
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

; Languages
!insertmacro MUI_LANGUAGE "English"

; Version Information - Extended for SmartScreen trust
VIProductVersion "${PRODUCT_VERSION}.0"
VIAddVersionKey "ProductName" "${PRODUCT_NAME}"
VIAddVersionKey "CompanyName" "${PRODUCT_PUBLISHER}"
VIAddVersionKey "FileDescription" "Professional Madden NFL File Editor - Roster and Franchise Management Tool"
VIAddVersionKey "FileVersion" "${PRODUCT_VERSION}"
VIAddVersionKey "ProductVersion" "${PRODUCT_VERSION}"
VIAddVersionKey "LegalCopyright" "Copyright © 2025 ${PRODUCT_PUBLISHER}"
VIAddVersionKey "LegalTrademarks" "Madden is a trademark of Electronic Arts Inc."
VIAddVersionKey "OriginalFilename" "Madden-Editor-Suite-Setup.exe"
VIAddVersionKey "Comments" "Open-source Madden NFL roster editor for PC"

Section "MainSection" SEC01
  ; Ensure we have admin rights before attempting install
  UserInfo::GetAccountType
  pop $0
  ${If} $0 != "admin"
    MessageBox MB_OK "Administrator rights required!"
    SetErrorLevel 740  ; ERROR_ELEVATION_REQUIRED
    Quit
  ${EndIf}

  SetOutPath "$INSTDIR"
  SetOverwrite ifnewer

  ; Use ClearErrors and detailed file operations
  ClearErrors

  ; Copy all files from Electron Forge package output
  File /r /x *.log "out\Madden Editor Suite-win32-x64\*"

  ; Check if file copy succeeded
  IfErrors 0 +3
    MessageBox MB_OK|MB_ICONEXCLAMATION "Error copying application files. Installation may be incomplete."
    Abort

  ; Create shortcuts
  CreateDirectory "$SMPROGRAMS\${PRODUCT_NAME}"
  CreateShortCut "$SMPROGRAMS\${PRODUCT_NAME}\${PRODUCT_NAME}.lnk" "$INSTDIR\madden-editor-suite.exe"
  CreateShortCut "$DESKTOP\${PRODUCT_NAME}.lnk" "$INSTDIR\madden-editor-suite.exe"
  CreateShortCut "$SMPROGRAMS\${PRODUCT_NAME}\Uninstall.lnk" "$INSTDIR\uninst.exe"
SectionEnd

Section -Post
  WriteUninstaller "$INSTDIR\uninst.exe"

  ; Application registration for legitimacy
  WriteRegStr HKLM "Software\${PRODUCT_PUBLISHER}\${PRODUCT_NAME}" "" "$INSTDIR\madden-editor-suite.exe"
  WriteRegStr HKLM "Software\${PRODUCT_PUBLISHER}\${PRODUCT_NAME}" "Version" "${PRODUCT_VERSION}"

  ; Get current date using NSIS built-in macro
  !define /date INSTALL_DATE "%Y-%m-%d"
  WriteRegStr HKLM "Software\${PRODUCT_PUBLISHER}\${PRODUCT_NAME}" "InstallDate" "${INSTALL_DATE}"

  ; Uninstaller registration - Extended metadata for Windows trust
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "DisplayName" "$(^Name)"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "UninstallString" "$INSTDIR\uninst.exe"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "DisplayIcon" "$INSTDIR\madden-editor-suite.exe"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "DisplayVersion" "${PRODUCT_VERSION}"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "Publisher" "${PRODUCT_PUBLISHER}"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "URLInfoAbout" "${PRODUCT_WEB_SITE}"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "URLUpdateInfo" "${PRODUCT_WEB_SITE}/releases"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "HelpLink" "${PRODUCT_WEB_SITE}/wiki"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegDWORD ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "NoModify" 1
  WriteRegDWORD ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "NoRepair" 1

  ; Estimate install size (in KB) - helps Windows categorize as legitimate
  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  IntFmt $0 "0x%08X" $0
  WriteRegDWORD ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "EstimatedSize" "$0"
SectionEnd

Section Uninstall
  Delete "$INSTDIR\uninst.exe"
  Delete "$DESKTOP\${PRODUCT_NAME}.lnk"
  Delete "$SMPROGRAMS\${PRODUCT_NAME}\*.*"

  RMDir /r "$SMPROGRAMS\${PRODUCT_NAME}"
  RMDir /r "$INSTDIR"

  DeleteRegKey ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}"
  DeleteRegKey HKLM "Software\${PRODUCT_PUBLISHER}\${PRODUCT_NAME}"

  SetAutoClose true
SectionEnd
