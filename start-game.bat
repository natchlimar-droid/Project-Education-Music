@echo off
title Siam Rhythm Local Server
echo Starting Siam Rhythm at http://localhost:8000 ...
start "" http://localhost:8000
node "%~dp0server.mjs"
pause
