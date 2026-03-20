import { execSync, spawn } from "child_process";
import { platform } from 'os';

function simpleQuote(args: string[]): string {
	return args
		.map((arg) => {
			if (/[^A-Za-z0-9_/:=-]/.test(arg)) {
				return `'${arg.replace(/'/g, `'\\''`)}'`;
			}
			return arg;
		})
		.join(' ');
}

function isExec(command: string): boolean {
	try {
		execSync(simpleQuote(command.split(' ')), { stdio: 'ignore' });
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
	"ffplay",
	"mplayer",
	"mpg123",
	"mpg321",
	"play",
	"aplay",
	"cmdmp3",
	"cvlc",
	"afplay",
	"omxplayer",
	"powershell",
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

const defaultPlayerArgs: Partial<Record<AvailablePlayer, string[]>> = {
	powershell: [
		"-NoProfile",
		"-NonInteractive",
		"-Command",
	],
	mplayer: ["-really-quiet", "-nolirc"],
	afplay: [],
	ffplay: ["-nodisp", "-autoexit", "-loglevel", "quiet"],
};

export class Player {
	#opts: PlayOpts;

	constructor(opts: Partial<PlayOpts> = {}) {
		this.#opts = Object.assign({}, defaultOptions, opts);
	}

	public async play(what: string, options: PlayMethodOptions = {}): Promise<void> {
		const promise = new Promise<void>((resolve, reject) => {
			if (!this.#opts.player) {
				return reject(new Error("Couldn't find a suitable audio player"));
			}

			let args: string[];

			if (this.#opts.player === "powershell") {
				const escaped = what.replace(/'/g, "''");
				const isWav = what.toLowerCase().endsWith('.wav');
    
				const command = isWav
					? `(New-Object Media.SoundPlayer '${escaped}').PlaySync()`
					: `$p = New-Object -ComObject WMPlayer.OCX; $p.URL = '${escaped}'; $p.controls.play(); Start-Sleep -s ($p.currentMedia.duration + 1)`;
    
				args = ["-NoProfile", "-NonInteractive", "-Command", command];
			} else if (Array.isArray(options[this.#opts.player])) {
				args = options[this.#opts.player]!.concat(what).map(String);
			} else {
				const defaults = defaultPlayerArgs[this.#opts.player] ?? [];
				args = [...defaults, what];
			}

			const child = spawn(this.#opts.player, args);

			child.on("close", (code, signal) => {
				if (code === 0) {
					resolve();
				} else if (signal) {
					reject(new Error("Audio playback was interrupted"));
				} else {
					reject(new Error(`Audio playback failed with exit code ${code}`));
				}
			});

			child.on("error", (err) => {
				reject(new Error(`Failed to start audio playback: ${err.message}`));
			});
		});

		try {
			await promise;
		} catch (err) {
			console.error("Error playing sound:", err);
		}
	}
}

export const soundPlayer = new Player();
