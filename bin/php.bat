@echo off
REM Lando PHP Wrapper Script (Windows)
REM This script redirects PHP calls to a Lando Docker container
REM Environment variables:
REM   VSCODE_LANDO_PHP_CONTAINER - The Docker container name
REM   VSCODE_LANDO_EXEC_CWD - The working directory inside the container

setlocal enabledelayedexpansion

REM Check if required environment variables are set
if "%VSCODE_LANDO_PHP_CONTAINER%"=="" (
    echo Error: VSCODE_LANDO_PHP_CONTAINER environment variable is not set >&2
    exit /b 1
)

if "%VSCODE_LANDO_EXEC_CWD%"=="" (
    echo Error: VSCODE_LANDO_EXEC_CWD environment variable is not set >&2
    exit /b 1
)

REM Execute PHP in the Lando container using docker exec with workdir flag
REM This avoids shell quoting issues by letting docker handle the working directory
docker exec -i -w "%VSCODE_LANDO_EXEC_CWD%" "%VSCODE_LANDO_PHP_CONTAINER%" php %*