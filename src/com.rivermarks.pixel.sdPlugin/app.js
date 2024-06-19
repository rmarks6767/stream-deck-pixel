/// <reference path="libs/js/action.js" />
/// <reference path="libs/js/stream-deck.js" />

const myAction = new Action('com.rivermarks.pixel.action');

/**
 * The first event fired when Stream Deck starts
 */
$SD.onConnected(({ actionInfo, appInfo, connection, messageType, port, uuid }) => {
	console.log('Stream Deck connected!');
	console.log('Attempting to get hue');

	fetch('https://discovery.meethue.com')
		.then(res => res.json())
		.then(devices => {
			if (devices.length === 1) {
				console.log('Found one device, connecting');
				console.log(devices[0]);
			}
		})
});

myAction.onKeyUp(({ action, context, device, event, payload }) => {
	console.log('Your key code goes here!');
});

