@echo off
REM Lando PHP Wrapper Script (Windows)
REM This script redirects PHP calls to a Lando Docker container
REM Environment variables:
REM   VSCODE_LANDO_PHP_CONTAINER - The Docker container name
REM   VSCODE_LANDO_EXEC_CWD - The working directory inside the container

REM Check if required environment variables are set
if "%VSCODE_LANDO_PHP_CONTAINER%"=="" (
    echo Error: VSCODE_LANDO_PHP_CONTAINER environment variable is not set
    exit /b 1
)

if "%VSCODE_LANDO_EXEC_CWD%"=="" (
    echo Error: VSCODE_LANDO_EXEC_CWD environment variable is not set
    exit /b 1
)

REM Execute PHP in the Lando container
docker exec -i "%VSCODE_LANDO_PHP_CONTAINER%" bash -c "cd '%VSCODE_LANDO_EXEC_CWD%' && php %*"