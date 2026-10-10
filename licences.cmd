@echo off
rem Ouvre l'interface de gestion des licences AFE (outil vendeur, local).
rem Double-cliquez sur ce fichier ; laissez la fenetre ouverte pendant l'utilisation.
chcp 65001 >nul
title AFE - Gestion des licences
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js est introuvable. Installez-le depuis https://nodejs.org puis relancez ce fichier.
  pause
  exit /b 1
)
node scripts\license\admin.mjs %*
if errorlevel 1 pause
