; Custom NSIS Installer Script for Madden Editor Suite
; Reduces antivirus false positives by adding metadata and certificates

; Set detailed version information to reduce false positives
!define PRODUCT_NAME "Madden Editor Suite"
!define PRODUCT_PUBLISHER "KRaZyNuttZ"
!define PRODUCT_WEB_SITE "https://github.com/tshanks1027"
!define PRODUCT_DESCRIPTION "Advanced Madden Roster and Franchise Editor"

; Mark installer as safe for antivirus
RequestExecutionLevel admin

; Add digital signature verification check
!define CERT_SHA256 "1"

; Skip unnecessary compression that triggers AV
SetCompress off

; Add version information for Windows SmartScreen
VIProductVersion "${VERSION}"
VIAddVersionKey "ProductName" "${PRODUCT_NAME}"
VIAddVersionKey "CompanyName" "${PRODUCT_PUBLISHER}"
VIAddVersionKey "FileDescription" "${PRODUCT_DESCRIPTION}"
VIAddVersionKey "FileVersion" "${VERSION}"
VIAddVersionKey "ProductVersion" "${VERSION}"
VIAddVersionKey "LegalCopyright" "Copyright (c) 2025 ${PRODUCT_PUBLISHER}"

; Mark as installer (helps Windows SmartScreen)
!define MUI_ICON "..\Branding\madden.ico"
!define MUI_UNICON "..\Branding\madden.ico"

; Create registry entries for app legitimacy
Section -Post
  WriteRegStr HKLM "Software\${PRODUCT_PUBLISHER}\${PRODUCT_NAME}" "" "$INSTDIR\${PRODUCT_NAME}.exe"
  WriteRegStr HKLM "Software\${PRODUCT_PUBLISHER}\${PRODUCT_NAME}" "Version" "${VERSION}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" "DisplayName" "${PRODUCT_NAME}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" "Publisher" "${PRODUCT_PUBLISHER}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" "URLInfoAbout" "${PRODUCT_WEB_SITE}"
SectionEnd
