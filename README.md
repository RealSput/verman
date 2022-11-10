# verman
Verman - a CLI tool to manage versions of folders.

# Usage
```
Usage: verman [options] [command]

A CLI tool to manage versions of folders.

Options:
  -V, --version    output the version number
  -h, --help       display help for command

Commands:
  manage <folder>  Manage a version of a folder
  help [command]   display help for command
```
Commands:
```
export <filename> - Exports all current versions into file.
gver - Gets current version.
help - Shows this help text.
import <filename> - Imports a file previously exported by the "export" command.
refresh - Refreshes a folder. Use after importing a file.
rnback <amount> - Rolls back a specific amount of versions..
rollback - Rolls back a version once.
undo - Undoes a rollback.
```
# Developement
This is still early in developement and might be very buggy. Do not use in production.