import { PixelManager } from "../pixelHelpers/PixelManager";
import { soundPlayer } from "../playSound";
import { DCType, Pixel, PixelConnectionState } from "./types";
import { GlobalSettingsController } from "./globalSettingsController";
import streamDeck from "@elgato/streamdeck";

export 	const setConnectionStatus = async (device: Pixel, connectionState: PixelConnectionState) => {
	const settings = await GlobalSettingsController.get();	
	
	await GlobalSettingsController.set({
		...settings,
		connectedDevices: {
			...settings.connectedDevices,
			[device.id]: {
				...device,
				connectionState,
			},
		},
	});
};

/**
 * Function responsible for running after plugin has successfully connected.
 * This will connect to all the devices stored in our global settings so the
 * individual actions do not.
 * @param pixelManager - An instance of the PixelManager class
 */
export const startup = async (pixelManager: PixelManager) => {
	let settings = await GlobalSettingsController.get();

	// Initial creation of the settings object
	if (!settings) {
		settings = {
			actions: {},
			connectedDevices: {},
		};

		await GlobalSettingsController.set(settings);
	}

	await Promise.all(
		Object.entries(settings.connectedDevices).map(async ([deviceId, device]) => {
			try {
				await setConnectionStatus(device, PixelConnectionState.CONNECTING);
				await pixelManager.connect(deviceId);
				await setConnectionStatus(device, PixelConnectionState.CONNECTED);
				await registerDCListener(pixelManager, device);
			} catch (error) {
				streamDeck.logger.error({
					message: '[startup]: Failed to connect to device, setting as disconnected',
					error
				})

				await setConnectionStatus(device, PixelConnectionState.DISCONNECTED);
			}
		}),
	);
};

export const registerDCListener = async (pixelManager: PixelManager, device: Pixel) => {
	const { dcConfig } = device;

	if (!dcConfig) {
		return;
	}

	pixelManager.removeListener(device.id, "global-dc-listener");

	let rolls: number[] = [];
	await pixelManager.addListener(device.id, {
		actionId: "global-dc-listener",
		type: "rollState",
		listener: async ({ type, faceIndex, state }) => {
			if (state === 1) {
				if (rolls.length === 2 || type === DCType.standard) {
					rolls = [];
				}

				rolls.push(faceIndex + 1);
				const [roll1, roll2] = rolls;

				switch (dcConfig.type) {
					case DCType.standard: {
						if (roll1 === 20 && dcConfig.nat20Audio) {
							await soundPlayer.play(dcConfig.nat20Audio);
						} else if (roll1 >= dcConfig.difficulty && dcConfig.successAudio) {
							await soundPlayer.play(dcConfig.successAudio);
						} else if (roll1 === 1 && dcConfig.nat1Audio) {
							await soundPlayer.play(dcConfig.nat1Audio);
						} else if (roll1 < dcConfig.difficulty && dcConfig.failureAudio) {
							await soundPlayer.play(dcConfig.failureAudio);
						}
						break;
					}

					case DCType.advantage: {
						if ((roll1 === 20 || roll2 === 20) && dcConfig.nat20Audio) {
							await soundPlayer.play(dcConfig.nat20Audio);
							rolls = [];
						} else if (
							((roll1 >= dcConfig.difficulty && !roll2) ||
								(roll1 < dcConfig.difficulty && roll2 >= dcConfig.difficulty)) &&
							dcConfig.successAudio
						) {
							await soundPlayer.play(dcConfig.successAudio);
						} else if ((roll1 === 1 || roll2 === 1) && dcConfig.nat1Audio) {
							await soundPlayer.play(dcConfig.nat1Audio);
						} else if (roll1 < dcConfig.difficulty && roll2 < dcConfig.difficulty && dcConfig.failureAudio) {
							await soundPlayer.play(dcConfig.failureAudio);
						}

						break;
					}

					case DCType.disadvantage: {
						if (roll1 === 20 && roll2 === 20 && dcConfig.nat20Audio) {
							await soundPlayer.play(dcConfig.nat20Audio);
						} else if (roll1 >= dcConfig.difficulty && roll2 >= dcConfig.difficulty && dcConfig.successAudio) {
							await soundPlayer.play(dcConfig.successAudio);
						} else if ((roll1 === 1 || roll2 === 1) && dcConfig.nat1Audio) {
							await soundPlayer.play(dcConfig.nat1Audio);
							rolls = [];
						} else if (
							((roll1 < dcConfig.difficulty && !roll2) ||
								(roll1 >= dcConfig.difficulty && roll2 < dcConfig.difficulty)) &&
							dcConfig.failureAudio
						) {
							await soundPlayer.play(dcConfig.failureAudio);
						}

						break;
					}
				}
			}
		},
	});
};

export const wait = async (ms: number) => {
	await new Promise((resolve) => {
		setTimeout(() => resolve(null), ms);
	})
}