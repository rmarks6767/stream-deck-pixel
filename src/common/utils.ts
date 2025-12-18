import streamDeck from "@elgato/streamdeck";

import { PixelManager } from "../pixelHelpers/PixelManagerV2";
import { soundPlayer } from "../playSound";
import { DCType, GlobalSettings, Pixel, PixelConnectionState } from "./types";

/**
 * Function responsible for running after plugin has successfully connected.
 * This will connect to all the devices stored in our global settings so the
 * individual actions do not.
 * @param pixelManager - An instance of the PixelManager class
 */
export const startup = async (pixelManager: PixelManager) => {
	let settings = await streamDeck.settings.getGlobalSettings<GlobalSettings>();

	// Initial creation of the settings object
	if (!settings) {
		settings = {
			actions: {},
			connectedDevices: {},
		};

		await streamDeck.settings.setGlobalSettings<GlobalSettings>(settings);
	}

	const setConnectionStatus = async (id: string, connectionState: PixelConnectionState) => {
		await streamDeck.settings.setGlobalSettings<GlobalSettings>({
			...settings,
			connectedDevices: {
				...settings.connectedDevices,
				[id]: {
					...settings.connectedDevices[id],
					connectionState,
				},
			},
		});
	};

	await Promise.all(
		Object.entries(settings.connectedDevices).map(async ([deviceId, device]) => {
			try {
				console.log(`[startup]: Attempting to connect to ${deviceId}`);

				await setConnectionStatus(deviceId, PixelConnectionState.CONNECTING);
				await pixelManager.connect(deviceId);
				await setConnectionStatus(deviceId, PixelConnectionState.CONNECTED);

				await registerDCListener(pixelManager, device);
				console.log(`[startup}]: Successfully connected to ${deviceId}`);
			} catch (error) {
				console.error(`[startup]: Failed to connect to device, setting as disconnected`, error);

				await setConnectionStatus(deviceId, PixelConnectionState.DISCONNECTED);
			}
		}),
	);
};

export const registerDCListener = async (pixelManager: PixelManager, device: Pixel) => {
	console.log(`[registerDCListener]: Registering DC listener for device ${device.id}`, device);
	
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
			console.log(`[registerDCListener]: Received roll event from device ${device.id} - type: ${type}, faceIndex: ${faceIndex}, state: ${state}`, dcConfig);

			if (state === 1) {
				if (rolls.length === 2 || type === DCType.standard) {
					rolls = [];
				}

				rolls.push(faceIndex + 1);
				const [roll1, roll2] = rolls;

				switch (type) {
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

/**
 * Helper function to set all the pixel devices as disconnected.
 */
export const setAllAsDisconnected = async () => {
	const settings = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
	const newConnectedDevices: { [key: string]: Pixel } = {};

	Object.entries(settings.connectedDevices || {}).forEach(([deviceId, device]) => {
		newConnectedDevices[deviceId] = {
			...device,
			connectionState: PixelConnectionState.DISCONNECTED,
		};
	});

	await streamDeck.settings.setGlobalSettings<GlobalSettings>({
		...settings,
		connectedDevices: newConnectedDevices,
	});
};
