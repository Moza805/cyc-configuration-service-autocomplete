// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const axios = require('axios');

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "cyc-configuration-service-autocomplete" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with  registerCommand
	// The commandId parameter must match the command field in package.json
	let disposableCommand = vscode.commands.registerCommand('extension.cycConfigurationActivate', async () => {
		// The code you place here will be executed every time your command is executed

		const applicationName = vscode.workspace.getConfiguration(null, null).get('cycConfiguration.applicationName');
		const environment = vscode.workspace.getConfiguration(null, null).get('cycConfiguration.applicationEnvironment');

		const selectedApplicationName = await vscode.window.showInputBox({ placeHolder: 'my-account', prompt: 'Application name', value: applicationName });
		if (selectedApplicationName === undefined) {
			return;
		}
		const selectedEnvironment = await vscode.window.showInputBox({ placeHolder: 'dev', prompt: 'Application environment', value: environment });
		if (selectedEnvironment === undefined) {
			return;
		}

		context.workspaceState.update('applicationName', selectedApplicationName);
		context.workspaceState.update('applicationEnvironment', selectedEnvironment);

		await loadConfiguration(context, selectedApplicationName, selectedEnvironment);
	});

	let disposableLanguage = vscode.languages.registerCompletionItemProvider({
		scheme: 'file',
		language: 'javascriptreact'

	}, {
		provideCompletionItems: async (document, position, cancellationToken, completionContext) => {
			const applicationName = context.workspaceState.get('applicationName');
			const applicationEnvironment = context.workspaceState.get('applicationEnvironment');
			if ((applicationName === undefined || applicationName.length === 0) ||
				(applicationEnvironment === undefined || applicationEnvironment.length === 0)) {
				await loadConfiguration(context, applicationName, applicationEnvironment);
			}

			const file = await vscode.workspace.openTextDocument(document);
			if (!file) {
				return null;
			}

			const text = document.lineAt(position.line).text;
			var searchText = text.slice(0, position.character);
			if (searchText.endsWith('FeatureFlagsService.')) {
				const flags = context.workspaceState.get('flags').map((flag) => ({ label: flag }));
				return flags;
			}
		}
	}, [
		'.'
	]);

	context.subscriptions.push(disposableCommand);
	context.subscriptions.push(disposableLanguage);
}

const loadConfiguration = async (context, applicationName, applicationEnvironment) => {
	try {
		const configuration = axios.get('https://cyc-configuration.azurewebsites.net/Configuration/' + applicationName + '/' + applicationEnvironment);
		const featureFlags = axios.get('https://cyc-configuration.azurewebsites.net/FeatureFlags/' + applicationName + '/' + applicationEnvironment);

		// Display a message box to the user
		vscode.window.showInformationMessage(`Loading config and flags for ${configuration} (${featureFlags})`);

		const results = await Promise.all([configuration, featureFlags])
			.catch((reason) => {
				vscode.window.showInformationMessage('Failed to retrieve configuration');
				throw new Error(reason);
			});

		// Map configuration and feature flags
		const availableFlags = results[1].data.map((flag) => flag.featureName);
		context.workspaceState.update('flags', availableFlags);
		context.workspaceState.update('configuration', configuration);

		vscode.window.showInformationMessage(`Loaded config and flags for ${configuration} (${featureFlags})`);
		return true;
	}
	catch (ex) {
		console.error(ex);
		return false;
	}
}

exports.activate = activate;

// this method is called when your extension is deactivated
function deactivate() { }

module.exports = {
	activate,
	deactivate
}
