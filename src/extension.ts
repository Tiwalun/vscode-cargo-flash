// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

import * as cp from 'child_process';
import * as util from 'util';
import { match } from 'assert';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "probe-rs" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('probe-rs.flash', flashProgram);

	context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() { }

async function flashProgram() {
	// The code you place here will be executed every time your command is executed

	console.log("Running cargo flash");

	let flash_output = vscode.window.createOutputChannel("cargo flash");

	// Don't reveal the output channel, when an error occurs
	// it will be revealed
	flash_output.show(true);

	flash_output.appendLine("Running 'cargo flash --release'");

	// TODO: Add user option to select workspace
	if (!vscode.workspace.workspaceFolders) {
		vscode.window.showErrorMessage("Unable to flash, open a workspace folder containing a Cargo project");
		return;
	}

	// TODO: Make working directory configurable
	let cwd = vscode.workspace.workspaceFolders[0].uri.fsPath;

	// TODO: Make cargo flash executable configurable (mostly for testing)
	let cargo_flash_executable = "../cargo-flash/target/debug/cargo-flash";

	// TODO: Make configurable
	let chip = "nrf51822";

	// TODO: Make configurable
	let speed = 100;

	vscode.window.withProgress({ title: "Flashing", cancellable: false, location: vscode.ProgressLocation.Notification }, (progress) => {

		progress.report({ message: "Building project" });

		// We want to run cargo flash here
		// let flash_process = cp.spawn("cargo", ["flash",  "--release"], { shell: true});
		let flash_process = cp.spawn(cargo_flash_executable, ["--work-dir", cwd, "--disable-progressbars", "--chip", chip, "--no-build", "--message-format=json", "--speed", speed.toString()]);

		// Create a promise out of 'flash_process'
		let p = new Promise((resolve, reject) => {
			flash_process.addListener("error", reject);
			flash_process.addListener("close", resolve);
		});


		let data_buffer = "";

		flash_process.stdout.on('data', (data: string) => {
			console.log(`stdout: ${data}`);
			// flash_output.appendLine(data);

			data_buffer += data;


			// Try to split data_buffer at newline

			let parts = data_buffer.split('\n');

			if (parts.length > 1) {

				for (let index = 0; index < parts.length - 1; index++) {
					const part = parts[index];

					let json_message = JSON.parse(part);

					if (json_message.reason === "build_finished") {
						progress.report({ message: "Build finished" });
					}

					if (json_message.type === "progress") {
						switch (json_message.event) {
							case "started_erasing":
								progress.report({ message: "Erasing chip" });
								console.log("Progress: Started erasing");
								break;
							case "started_flashing":
								progress.report({ message: "Flashing chip" });
								console.log("Progress: Started flashing");
								break;
							default:
								break;
						}
					}
				}

				// Store remainder in data_buffer
				data_buffer = parts[parts.length - 1];
			}
		});

		flash_process.stderr.on('data', (data) => {
			console.error(`stderr: ${data}`);

			// This should be append, but that doesn't work...
			flash_output.appendLine(data);
		});


		flash_process.on('error', (err) => {
			vscode.window.showErrorMessage(`Failed to spawn cargo flash: ${err}`);
		});


		flash_process.on('close', (code) => {
			if (code !== 0) {
				vscode.window.showErrorMessage(`Failed to flash chip: See output for more detail.`);
				flash_output.appendLine(`Failed to run cargo flash: exit code ${code}`);

				// Ensure flash output is shown.
				flash_output.show(false);
			} else {
				flash_output.appendLine('cargo flash finished');
			}

			console.log(`Process exited with code ${code}`);
		});

		return p;
	});
}
