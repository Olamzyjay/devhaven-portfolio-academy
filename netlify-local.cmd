@echo off
setlocal

REM Netlify CLI needs to write to APPDATA. In this workspace sandbox, APPDATA may be blocked,
REM so we redirect Netlify's config store into this project folder.
set "NETLIFY_LOCAL_APPDATA=%~dp0.netlify-local-appdata"
if not exist "%NETLIFY_LOCAL_APPDATA%" mkdir "%NETLIFY_LOCAL_APPDATA%"

set "APPDATA=%NETLIFY_LOCAL_APPDATA%"
set "LOCALAPPDATA=%NETLIFY_LOCAL_APPDATA%"
set "XDG_CONFIG_HOME=%NETLIFY_LOCAL_APPDATA%"

REM Clear proxy env vars that can break Netlify/NPM on this machine.
set "HTTP_PROXY="
set "HTTPS_PROXY="
set "ALL_PROXY="
set "NO_PROXY=localhost,127.0.0.1,::1"

call "%~dp0node_modules\\.bin\\netlify.cmd" %*

endlocal
