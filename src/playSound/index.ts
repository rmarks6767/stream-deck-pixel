import { spawn } from "child_process";

import { findExec } from "./utils.js";

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
		console.log('we are here')
		
		return new Promise((resolve, reject) => {
			const args = Array.isArray(options[this.#opts.player])
				? options[this.#opts.player]!.concat(what).map(String)
				: [what];

			if (!this.#opts.player) {
				return reject("Couldn't find a suitable audio player");
			}

			console.log(this.#opts.player);
			console.log(args);

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
