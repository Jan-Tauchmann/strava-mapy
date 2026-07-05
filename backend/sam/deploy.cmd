@echo off
REM Deploy the Strava-Mapy API stack using AWS SAM
REM Usage: deploy.cmd [--guided]
REM
REM First time: run with --guided to set StravaClientSecret and create samconfig.toml
REM Subsequent: just run deploy.cmd

cd /d "%~dp0"

if "%1"=="--guided" (
    sam deploy --guided
) else (
    sam build && sam deploy
)
