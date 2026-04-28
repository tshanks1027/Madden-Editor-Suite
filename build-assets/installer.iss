; Inno Setup Script for Madden Editor Suite
; Supports installers larger than 2GB (no NSIS limitation)

#define MyAppName "Madden Editor Suite"
#define MyAppVersion "3.4.1"
#define MyAppPublisher "KRaZyNuttZ"
#define MyAppURL "https://github.com/tshanks1027/madden-editor-suite"
#define MyAppExeName "madden-editor-suite.exe"

[Setup]
; NOTE: The value of AppId uniquely identifies this application.
AppId={{5a8f7c3b-1d9e-4a2f-b5c6-8e3d4f2a1b0c}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={localappdata}\{#MyAppName}
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
; Output settings
OutputDir=..\dist
OutputBaseFilename=madden-editor-suite-Setup-{#MyAppVersion}
; Compression - LZMA2 with ultra settings for best compression
Compression=lzma2/ultra64
SolidCompression=yes
LZMAUseSeparateProcess=yes
LZMANumBlockThreads=4
; Large file support (no 2GB limit)
DiskSpanning=no
; Icons
SetupIconFile=madden.ico
UninstallDisplayIcon={app}\{#MyAppExeName}
; Privileges
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
; Misc
WizardStyle=modern
DisableProgramGroupPage=yes
; 64-bit only
ArchitecturesInstallIn64BitMode=x64compatible
ArchitecturesAllowed=x64compatible

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
; Include all files from the packaged app
Source: "..\out\Madden Editor Suite-win32-x64\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent
