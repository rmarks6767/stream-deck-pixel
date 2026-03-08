import { execSync, spawn } from "child_process";
import {platform} from 'os';

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

function isExec(command: string): boolean {
	try {
		execSync(simpleQuote(command.split(' ')), {stdio: 'ignore'});
		return true;
	} catch {
		return false;
	}
}

function findCommand(): string {
	if (/^win/.test(platform())) {
		return 'where';
	} else {
		return 'command -v';
	}
}

function findExec(...commands: string[]): string | null {
	const find = findCommand();
	for (const command of commands) {
		if (isExec(`${find} ${command}`)) {
			return command;
		}
	}
	return null;
}

const availablePlayers = [
	"mplayer",
	"afplay",
	"mpg123",
	"mpg321",
	"play",
	"omxplayer",
	"aplay",
	"cmdmp3",
	"cvlc",
	"powershell",
	"ffplay",
] as const;

type AvailablePlayer = (typeof availablePlayers)[number];

interface PlayOpts {
	players: AvailablePlayer[];
	player: AvailablePlayer;
}

const defaultOptions: PlayOpts = {
	players: [...availablePlayers],
	player: findExec(...availablePlayers) as AvailablePlayer,
};

type PlayMethodOptions = Partial<
	{
		[value in AvailablePlayer]: Array<number | string>;
	} & {
		timeout: number;
	}
>;

export class Player {
	#opts: PlayOpts;

	constructor(opts: Partial<PlayOpts> = {}) {
		this.#opts = Object.assign({}, defaultOptions, opts);
	}

	public play(what: string, options: PlayMethodOptions = {}): Promise<void> {
		return new Promise((resolve, reject) => {
			const args = Array.isArray(options[this.#opts.player])
				? options[this.#opts.player]!.concat(what).map(String)
				: [what];

			if (!this.#opts.player) {
				return reject("Couldn't find a suitable audio player");
			}

			const process = spawn(this.#opts.player, args);

			if (!process) {
				return reject("Unable to spawn process with " + this.#opts.player);
			}

			process.on("close", (code, signal) => {
				if (code === 0) {
					// The audio played successfully and the process exited normally
					resolve();
				} else {
					// If the process ended with an error or was killed
					if (signal) {
						// Process was killed by a signal (like 'SIGTERM' or 'SIGKILL')
						reject(new Error("Audio playback was interrupted"));
					} else {
						// Some error occurred with the command
						reject(new Error(`Audio playback failed with exit code ${code}`));
					}
				}
			});
			process.on("error", (err) => {
				reject(new Error(`Failed to start audio playback: ${err.message}`));
			});
		});
	}
}

export const soundPlayer = new Player();
