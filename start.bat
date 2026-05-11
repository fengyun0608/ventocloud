@echo off
cd /d %~dp0
title VentoCloud
node --import tsx src/index.ts
pause