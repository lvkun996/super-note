; Register the built-in Windows plain-text preview handler for Super Note files.
; This only adds Explorer preview metadata and does not change the user's
; default application choice for .snote files.

!define SUPER_NOTE_PREVIEW_SHELLEX "{8895b1c6-b41f-4c1c-a562-0d564250836f}"
!define SUPER_NOTE_PLAIN_TEXT_HANDLER "{1531d583-8375-4d3f-b5fb-d23bbd169f22}"

!macro superNoteRegisterPreview
  WriteRegStr SHELL_CONTEXT "Software\Classes\.snote" "Content Type" "text/plain"
  WriteRegStr SHELL_CONTEXT "Software\Classes\.snote" "PerceivedType" "text"
  WriteRegStr SHELL_CONTEXT "Software\Classes\.snote\ShellEx\${SUPER_NOTE_PREVIEW_SHELLEX}" "" "${SUPER_NOTE_PLAIN_TEXT_HANDLER}"
!macroend

!macro superNoteUnregisterPreview
  DeleteRegValue SHELL_CONTEXT "Software\Classes\.snote" "Content Type"
  DeleteRegValue SHELL_CONTEXT "Software\Classes\.snote" "PerceivedType"
  DeleteRegValue SHELL_CONTEXT "Software\Classes\.snote\ShellEx\${SUPER_NOTE_PREVIEW_SHELLEX}" ""
!macroend

!macro customInstall
  !insertmacro superNoteRegisterPreview
  System::Call "shell32::SHChangeNotify(i, i, i, i) (0x08000000, 0x00001000, 0, 0)"
!macroend

!macro customUnInstall
  !insertmacro superNoteUnregisterPreview
  System::Call "shell32::SHChangeNotify(i, i, i, i) (0x08000000, 0x00001000, 0, 0)"
!macroend
