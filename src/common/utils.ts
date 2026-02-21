import { PixelManager } from "./pixelManager";
// import { soundPlayer } from "../playSound";
import { Pixel, PixelConnectionState } from "./types";
import { defaultGlobalSettings, GlobalSettingsController } from "./globalSettingsController";
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
		settings = defaultGlobalSettings;
		await GlobalSettingsController.set(settings);
	}

	await Promise.all(
		Object.entries(settings.connectedDevices).map(async ([deviceId, device]) => {
			try {
				await setConnectionStatus(device, PixelConnectionState.CONNECTING);
				await pixelManager.connect(deviceId);
				await setConnectionStatus(device, PixelConnectionState.CONNECTED);
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

export const wait = async (ms: number) => {
	await new Promise((resolve) => {
		setTimeout(() => resolve(null), ms);
	})
}