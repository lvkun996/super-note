; Register Super Note as a Windows Default Apps candidate and attach the
; built-in plain-text Preview Handler to every text format the app opens.
;
; Windows 8 and newer require the user to choose defaults in system UI. The
; installer therefore claims only Super Note's own .snote format directly;
; existing defaults for common text and source-code formats are preserved.

!define SUPER_NOTE_PREVIEW_SHELLEX "{8895b1c6-b41f-4c1c-a562-0d564250836f}"
!define SUPER_NOTE_PLAIN_TEXT_HANDLER "{1531d583-8375-4d3f-b5fb-d23bbd169f22}"
!define SUPER_NOTE_CAPABILITIES "Software\Clients\Super Note\Capabilities"

!macro superNoteRegisterFileType EXT PROGID DESCRIPTION MIME
  WriteRegNone SHELL_CONTEXT "Software\Classes\.${EXT}\OpenWithProgids" "${PROGID}"
  WriteRegStr SHELL_CONTEXT "${SUPER_NOTE_CAPABILITIES}\FileAssociations" ".${EXT}" "${PROGID}"
  WriteRegStr SHELL_CONTEXT "Software\Classes\Applications\${APP_EXECUTABLE_FILENAME}\SupportedTypes" ".${EXT}" "${MIME}"

  WriteRegStr SHELL_CONTEXT "Software\Classes\${PROGID}" "" "${DESCRIPTION}"
  WriteRegStr SHELL_CONTEXT "Software\Classes\${PROGID}\DefaultIcon" "" "$appExe,0"
  WriteRegStr SHELL_CONTEXT "Software\Classes\${PROGID}\shell" "" "open"
  WriteRegStr SHELL_CONTEXT "Software\Classes\${PROGID}\shell\open" "" "Open with Super Note"
  WriteRegStr SHELL_CONTEXT "Software\Classes\${PROGID}\shell\open\command" "" "$\"$appExe$\" $\"%1$\""
  WriteRegStr SHELL_CONTEXT "Software\Classes\${PROGID}\ShellEx\${SUPER_NOTE_PREVIEW_SHELLEX}" "" "${SUPER_NOTE_PLAIN_TEXT_HANDLER}"

  ; Preserve MIME metadata already supplied by Windows or another app.
  ReadRegStr $0 SHELL_CONTEXT "Software\Classes\.${EXT}" "Content Type"
  StrCmp $0 "" 0 +2
    WriteRegStr SHELL_CONTEXT "Software\Classes\.${EXT}" "Content Type" "${MIME}"
  ReadRegStr $0 SHELL_CONTEXT "Software\Classes\.${EXT}" "PerceivedType"
  StrCmp $0 "" 0 +2
    WriteRegStr SHELL_CONTEXT "Software\Classes\.${EXT}" "PerceivedType" "text"
!macroend

!macro superNoteUnregisterFileType EXT PROGID
  DeleteRegValue SHELL_CONTEXT "Software\Classes\.${EXT}\OpenWithProgids" "${PROGID}"
  DeleteRegKey /ifempty SHELL_CONTEXT "Software\Classes\.${EXT}\OpenWithProgids"
  DeleteRegValue SHELL_CONTEXT "${SUPER_NOTE_CAPABILITIES}\FileAssociations" ".${EXT}"
  DeleteRegValue SHELL_CONTEXT "Software\Classes\Applications\${APP_EXECUTABLE_FILENAME}\SupportedTypes" ".${EXT}"
  DeleteRegKey SHELL_CONTEXT "Software\Classes\${PROGID}"
!macroend

!macro superNoteRemoveLegacyExtensionPreview EXT
  ; Versions through 0.1.13 placed the preview handler directly on .snote.
  ; Remove only the value owned by Super Note, leaving any other handler alone.
  ReadRegStr $0 SHELL_CONTEXT "Software\Classes\.${EXT}\ShellEx\${SUPER_NOTE_PREVIEW_SHELLEX}" ""
  StrCmp $0 "${SUPER_NOTE_PLAIN_TEXT_HANDLER}" 0 +3
    DeleteRegValue SHELL_CONTEXT "Software\Classes\.${EXT}\ShellEx\${SUPER_NOTE_PREVIEW_SHELLEX}" ""
    DeleteRegKey /ifempty SHELL_CONTEXT "Software\Classes\.${EXT}\ShellEx\${SUPER_NOTE_PREVIEW_SHELLEX}"
  DeleteRegKey /ifempty SHELL_CONTEXT "Software\Classes\.${EXT}\ShellEx"
!macroend

!macro superNoteRegisterFileTypes
  WriteRegStr SHELL_CONTEXT "Software\RegisteredApplications" "Super Note" "${SUPER_NOTE_CAPABILITIES}"
  WriteRegStr SHELL_CONTEXT "${SUPER_NOTE_CAPABILITIES}" "ApplicationName" "Super Note"
  WriteRegStr SHELL_CONTEXT "${SUPER_NOTE_CAPABILITIES}" "ApplicationDescription" "Edit and preview notes, Markdown, text, and source files with Super Note."
  WriteRegStr SHELL_CONTEXT "Software\Classes\Applications\${APP_EXECUTABLE_FILENAME}" "FriendlyAppName" "Super Note"
  WriteRegStr SHELL_CONTEXT "Software\Classes\Applications\${APP_EXECUTABLE_FILENAME}\shell\open\command" "" "$\"$appExe$\" $\"%1$\""

  !insertmacro superNoteRegisterFileType "snote" "SuperNote.AssocFile.snote" "Super Note document" "text/plain"
  !insertmacro superNoteRegisterFileType "txt" "SuperNote.AssocFile.txt" "Text document" "text/plain"
  !insertmacro superNoteRegisterFileType "md" "SuperNote.AssocFile.md" "Markdown document" "text/markdown"
  !insertmacro superNoteRegisterFileType "markdown" "SuperNote.AssocFile.markdown" "Markdown document" "text/markdown"
  !insertmacro superNoteRegisterFileType "json" "SuperNote.AssocFile.json" "JSON document" "application/json"
  !insertmacro superNoteRegisterFileType "csv" "SuperNote.AssocFile.csv" "CSV document" "text/csv"
  !insertmacro superNoteRegisterFileType "log" "SuperNote.AssocFile.log" "Log file" "text/plain"
  !insertmacro superNoteRegisterFileType "ts" "SuperNote.AssocFile.ts" "TypeScript source file" "text/plain"
  !insertmacro superNoteRegisterFileType "tsx" "SuperNote.AssocFile.tsx" "TSX source file" "text/plain"
  !insertmacro superNoteRegisterFileType "js" "SuperNote.AssocFile.js" "JavaScript source file" "text/plain"
  !insertmacro superNoteRegisterFileType "jsx" "SuperNote.AssocFile.jsx" "JSX source file" "text/plain"
  !insertmacro superNoteRegisterFileType "css" "SuperNote.AssocFile.css" "CSS source file" "text/css"
  !insertmacro superNoteRegisterFileType "html" "SuperNote.AssocFile.html" "HTML document" "text/html"

  ; .snote belongs to Super Note. Leave a user's explicit choice untouched.
  ReadRegStr $0 SHELL_CONTEXT "Software\Classes\.snote" ""
  StrCmp $0 "" 0 +2
    WriteRegStr SHELL_CONTEXT "Software\Classes\.snote" "" "SuperNote.AssocFile.snote"

  !insertmacro superNoteRemoveLegacyExtensionPreview "snote"
!macroend

!macro superNoteUnregisterFileTypes
  ReadRegStr $0 SHELL_CONTEXT "Software\Classes\.snote" ""
  StrCmp $0 "SuperNote.AssocFile.snote" 0 +2
    DeleteRegValue SHELL_CONTEXT "Software\Classes\.snote" ""

  !insertmacro superNoteUnregisterFileType "snote" "SuperNote.AssocFile.snote"
  !insertmacro superNoteUnregisterFileType "txt" "SuperNote.AssocFile.txt"
  !insertmacro superNoteUnregisterFileType "md" "SuperNote.AssocFile.md"
  !insertmacro superNoteUnregisterFileType "markdown" "SuperNote.AssocFile.markdown"
  !insertmacro superNoteUnregisterFileType "json" "SuperNote.AssocFile.json"
  !insertmacro superNoteUnregisterFileType "csv" "SuperNote.AssocFile.csv"
  !insertmacro superNoteUnregisterFileType "log" "SuperNote.AssocFile.log"
  !insertmacro superNoteUnregisterFileType "ts" "SuperNote.AssocFile.ts"
  !insertmacro superNoteUnregisterFileType "tsx" "SuperNote.AssocFile.tsx"
  !insertmacro superNoteUnregisterFileType "js" "SuperNote.AssocFile.js"
  !insertmacro superNoteUnregisterFileType "jsx" "SuperNote.AssocFile.jsx"
  !insertmacro superNoteUnregisterFileType "css" "SuperNote.AssocFile.css"
  !insertmacro superNoteUnregisterFileType "html" "SuperNote.AssocFile.html"

  DeleteRegValue SHELL_CONTEXT "Software\RegisteredApplications" "Super Note"
  DeleteRegKey SHELL_CONTEXT "Software\Clients\Super Note"
  DeleteRegKey SHELL_CONTEXT "Software\Classes\Applications\${APP_EXECUTABLE_FILENAME}"
  !insertmacro superNoteRemoveLegacyExtensionPreview "snote"
!macroend

!macro customInstall
  !insertmacro superNoteRegisterFileTypes
  System::Call "shell32::SHChangeNotify(i, i, i, i) (0x08000000, 0x00001000, 0, 0)"
!macroend

!macro customUnInstall
  !insertmacro superNoteUnregisterFileTypes
  System::Call "shell32::SHChangeNotify(i, i, i, i) (0x08000000, 0x00001000, 0, 0)"
!macroend
