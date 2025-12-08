import streamDeck from "@elgato/streamdeck"
import { GlobalSettings, PixelConnectionState } from "./types"
import { PixelManager } from "../pixelHelpers/PixelManagerV2";

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
			connectedDevices: {}
		}

		await streamDeck.settings.setGlobalSettings<GlobalSettings>(settings);
		await streamDeck.settings.getGlobalSettings();
	}

	const setConnectionStatus = async (id: string, connectionState: PixelConnectionState) => {
		await streamDeck.settings.setGlobalSettings<GlobalSettings>({
			...settings,
			connectedDevices: {
				...settings.connectedDevices,
				[id]: {
					...settings.connectedDevices[id],
					connectionState,
				}
			}
		});
		await streamDeck.settings.getGlobalSettings();
	}

	await Promise.all(
		Object.keys(settings.connectedDevices).map(async (deviceId) => {
			try {
				console.log(`[startup]: Attempting to connect to ${deviceId}`);
				
				await setConnectionStatus(deviceId, PixelConnectionState.CONNECTING);
				await pixelManager.connect(deviceId);
				await setConnectionStatus(deviceId, PixelConnectionState.CONNECTED);

				console.log(`[startup}]: Successfully connected to ${deviceId}`);
			} catch (error) {
				console.error(`[startup]: Failed to connect to device, setting as disconnected`, error);
                
				await setConnectionStatus(deviceId, PixelConnectionState.DISCONNECTED);
			}
		})
	);

	// We will finally register a settings listener to disconnect a device if all actions no longer reference it
	// streamDeck.settings.onDidReceiveGlobalSettings(async (event: DidReceiveGlobalSettingsEvent<GlobalSettings>) => {
	// 	const actionDevices = new Set<string>();

	// 	Object.entries(event.settings.actions).forEach(([, { pixelId }]) => {
	// 		if (pixelId) {
	// 			actionDevices.add(pixelId);
	// 		}
	// 	});

	// 	await Promise.all(
	// 		Object.keys(event.settings.knownDevices).map(async (deviceId) => {
	// 			if (!actionDevices.has(deviceId)) {
	// 				await pixelManager.disconnect(deviceId);
	// 			}
	// 		})
	// 	);
	// });
}