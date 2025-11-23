import {execSync} from 'child_process';
import {platform} from 'os';
// import {quote} from 'shell-quote';

/**
 *
 * @param args
 */
function simpleQuote(args: string[]): string {
	return args
		.map((arg) => {
			// Escape single quotes by closing, adding \' and reopening quotes
			if (/[^A-Za-z0-9_/:=-]/.test(arg)) {
				return `'${arg.replace(/'/g, `'\\''`)}'`;
			}
			return arg;
		})
		.join(' ');
}

/**
 *
 * @param command
 */
function isExec(command: string): boolean {
	try {
		execSync(simpleQuote(command.split(' ')), {stdio: 'ignore'});
		return true;
	} catch {
		return false;
	}
}

/**
 *
 */
function findCommand(): string {
	if (/^win/.test(platform())) {
		return 'where';
	} else {
		return 'command -v';
	}
}

/**
 *
 * @param commands
 */
export function findExec(...commands: string[]): string | null {
	const find = findCommand();
	for (const command of commands) {
		if (isExec(`${find} ${command}`)) {
			return command;
		}
	}
	return null;
}