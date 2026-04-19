@echo off
setlocal
cd /d "%~dp0"

echo.
echo DevHaven Studio: Netlify production deploy
echo ----------------------------------------
echo 1) If this is your first time, run:
echo      netlify-local.cmd login
echo 2) Then link or create a site:
echo      netlify-local.cmd init --manual
echo 3) Finally deploy to production:
echo      netlify-local.cmd deploy --prod --dir="%cd%"
echo.
echo Running production deploy now...
echo.

call "%~dp0netlify-local.cmd" deploy --prod --dir="%cd%"

endlocal
