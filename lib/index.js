#!/usr/bin/env node
const streamBuffers = require('stream-buffers');
const archiver = require('archiver');
const unzipper = require('unzipper');
const repl = require('repl');
const zlib = require('zlib');
const fs = require('fs');

let folder_name;
let in_rollback = false;
let versions = [];
let old_vers = [];

let zip = (fds) => {
    return new Promise((resolve, reject) => {
        let output = new streamBuffers.WritableStreamBuffer({
            initialSize: (1000 * 1024),
            incrementAmount: (1000 * 1024)
        });

        let archive = archiver('zip');

        archive.on('finish', () => {
            resolve({
                output: output.getContents(),
                size: archive.pointer()
            });
        });

        archive.on('error', function(err) {
            throw err;
        });

        archive.pipe(output);

        archive.directory(fds, false);
        archive.finalize();
    });
}

global.open = true;

let watcher;

let reopen = () => {
    watcher = fs.watch(folder_name, async (evt, fn) => {
        if (global.open) {
            let zipped = await zip(folder_name);
            versions.push(zipped);
            console.log(`[INFO] Change detected in folder "${folder_name}", version updated to v${versions.length}.`)
        }
    });
}

let unzip = (buf, size) => {
    return new Promise((resolve, reject) => {
        var unzipBuffer = new streamBuffers.ReadableStreamBuffer({
            initialSize: size,
            incrementAmount: (10 * 1024)
        });
        unzipBuffer.put(buf);
        unzipBuffer.pipe(unzipper.Extract({
            path: folder_name
        })).on('finish', () => {
            resolve(true);
        });
    });
}

let processCommand = async (prcs) => {
    let cmd = prcs.slice(0, -1).split(" ")[0];
    let args = prcs.slice(0, -1).split(' ').slice(1);
    prcs = cmd.toLowerCase().slice(0, -1);
    switch (cmd) {
        case "rollback":
            if (!versions.length) {
                console.log("[ERROR] No versions to undo.");
            } else {
                var lv = versions[versions.length - 2];
                if (lv) {
                    old_vers.push(versions);
                    versions = versions.slice(0, -1);
                    watcher.close();
                    global.open = false;
                    fs.rmSync(folder_name, {
                        recursive: true
                    });
                    await unzip(lv.output, lv.size);
                    setTimeout(() => {
                        open = true;
                        reopen();
                    }, 100);
                    console.log(`[INFO] Rolled back version to v${versions.length}.`)
                } else {
                    lv = versions[versions.length - 1];
                    old_vers.push(versions);
                    versions = versions.slice(0, -1);
                    watcher.close();
                    global.open = false;
                    fs.rmSync(folder_name, {
                        recursive: true
                    });
                    await unzip(lv.output, lv.size);
                    setTimeout(() => {
                        open = true;
                        reopen();
                    }, 100);
                    console.log(`[INFO] Rolled back version to v${versions.length}.`)
                }
            }
            break;
        case "gver":
            console.log(`[INFO] Current version is v${versions.length}.`)
            break;
        case "rnback":
            let am = (parseInt(args[0]) - 1) * -1;
            if (!args[0]) {
                console.log("[ERROR] Please specify an amount to roll back.");
            } else {
                old_vers.push(versions);
                versions = versions.slice(0, am);
                var lv = versions[versions.length - 1];
                watcher.close();
                global.open = false;
                fs.rmSync(folder_name, {
                    recursive: true
                });
                await unzip(lv.output, lv.size);
                setTimeout(() => {
                    open = true;
                    reopen();
                }, 100);
                console.log(`[INFO] Rolled back version to v${versions.length}.`)
            }
            break;
        case "export":
            var file = args[0];
            if (!file) {
                console.log("[ERROR] A file must be specified.");
            } else {
                let versionsAsString = versions.map(x => {
                    let buf = Array.from(new Uint8Array(x.output));
                    let json = {
                        size: x.size,
                        output: buf
                    };
                    return JSON.stringify(json);
                }).join('|');
                let compressed = zlib.gzipSync(versionsAsString);
                fs.writeFileSync(file, compressed);
                console.log(`[INFO] Exported versions to "${file}".`)
            }
            break;
        case "import":
            var file = args[0];
            if (!file) {
                console.log("[ERROR] A file must be specified.");
            } else {
                let stored_versions = fs.readFileSync(file);
                let data = zlib.gunzipSync(stored_versions).toString().split('|')
                data = data.map(x => {
                    x = JSON.parse(x);
                    return {
                        output: Buffer.from(Uint8Array.from(x.output).buffer),
                        size: x.size
                    };
                });
                old_vers.push(versions);
                versions = data;
                console.log(`[INFO] Imported versions from "${file}".`)
            }
            break;
        case "refresh":
            var lv = versions[versions.length - 1];
            watcher.close();
            global.open = false;
            fs.rmSync(folder_name, {
                recursive: true
            });
            await unzip(lv.output, lv.size);
            setTimeout(() => {
                open = true;
                reopen();
            }, 100);
            console.log(`[INFO] Refreshed folder.`)
            break;
        case "undo":
            if (old_vers.length) {
                versions = old_vers.pop();
                var lv = versions[versions.length - 1];
                watcher.close();
                global.open = false;
                fs.rmSync(folder_name, {
                    recursive: true
                });
                await unzip(lv.output, lv.size);
                console.log(`[INFO] Undid change.`)
                setTimeout(() => {
                    open = true;
                    reopen();
                }, 100);
            } else {
                console.log("[ERROR] No version to undo.")
            }
            break;
        case "help":
            console.log(`Verman commands:

export <filename> - Exports all current versions into file.
gver - Gets current version.
help - Shows this help text.
import <filename> - Imports a file previously exported by the "export" command.
refresh - Refreshes a folder. Use after importing a file.
rnback <amount> - Rolls back a specific amount of versions..
rollback - Rolls back a version once.
undo - Undoes a rollback.`)
            break;
        default:
            if (!(/^\s*$/).match(cmd)) {
                console.log(`[ERROR] Command not valid:`, JSON.stringify(cmd))
            };
            break;
    }
}

async function func(cmd, context, filename, callback) {
    callback(null, await processCommand(cmd));
}

let start = () => {
    watcher = fs.watch(folder_name, async (evt, fn) => {
      if (global.open) {
          let zipped = await zip(folder_name);
          versions.push(zipped);
          console.log(`[INFO] Change detected in folder "${folder_name}", version updated to v${versions.length}.`)
      }
    });
    console.log("Welcome to the Verman REPL.");
    console.log("Type \"help\" to get started.");

    repl.start({
        prompt: '> ',
        eval: func,
        writer: () => '\x1b[0K'
    });
}

let sdir = (arg) => folder_name = arg;

module.exports = {
    start,
    sdir
};