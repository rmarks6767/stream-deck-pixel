/// This file was adapted from the `@systemic-games/pixels-core-connect` package
/// It abstracts the serialization and deserialization of Pixel messages to make 
/// our package lighter weight (since tree shaking wasn't working for whatever
/// reason)

/* eslint-disable @typescript-eslint/explicit-member-accessibility */
/* eslint-disable @typescript-eslint/member-ordering */
/* eslint-disable @typescript-eslint/no-explicit-any */

import "reflect-metadata";

class AssertionError extends Error {
	constructor(message?: string) {
		super(message);
		this.name = "AssertionError";
	}
}

class SerializationError extends Error {
	constructor(message?: string) {
		super(message);
		this.name = "SerializationError";
	}
}

class DecodeUtf8Error extends Error {
	public readonly decodedString: string;
	constructor(message: string, decodedString: string) {
		super(message);
		this.name = "DecodeUtf8Error";
		this.decodedString = decodedString;
	}
}

function assert(value: unknown, msg?: string): asserts value {
	if (!value) {
		throw new AssertionError(msg ?? `Assertion failed with value ${value}`);
	}
}

function decodeUtf8(bytes: Uint8Array): string {
	let i = 0,
		s = "";
	while (i < bytes.length) {
		let c = bytes[i++];
		if (!c) {
			break;
		} else if (c > 127) {
			if (c > 191 && c < 224) {
				if (i >= bytes.length) throw new DecodeUtf8Error("Incomplete 2-bytes sequence", s);
				c = ((c & 31) << 6) | (bytes[i++] & 63);
			} else if (c > 223 && c < 240) {
				if (i + 1 >= bytes.length) throw new DecodeUtf8Error("Incomplete 3-bytes sequence", s);
				c = ((c & 15) << 12) | ((bytes[i++] & 63) << 6) | (bytes[i++] & 63);
			} else if (c > 239 && c < 248) {
				if (i + 2 >= bytes.length) throw new DecodeUtf8Error("Incomplete 4-bytes sequence", s);
				c = ((c & 7) << 18) | ((bytes[i++] & 63) << 12) | ((bytes[i++] & 63) << 6) | (bytes[i++] & 63);
			} else
				throw new DecodeUtf8Error(`Unknown multibyte start 0x${c.toString(16).padStart(2, "0")} at index ${i - 1}`, s);
		}
		if (c <= 0xffff) s += String.fromCharCode(c);
		else if (c <= 0x10ffff) {
			c -= 0x10000;
			s += String.fromCharCode((c >> 10) | 0xd800);
			s += String.fromCharCode((c & 0x3ff) | 0xdc00);
		} else throw new DecodeUtf8Error(`Code point 0x${c.toString(16).padStart(2, "0")} exceeds UTF-16 reach`, s);
	}
	return s;
}

const serializableKey = Symbol.for("PixelsAnimationSerializable");

interface SerializableProperty {
	propertyKey: string;
	size: number;
	options?: SerializableOptions;
}

interface SerializableOptions {
	padding?: number;
	numberFormat?: "float" | "signed" | "unsigned";
	nullTerminated?: boolean;
	terminator?: boolean;
}

function serializable(size: number, options?: SerializableOptions): PropertyDecorator {
	return function registerProperty(target: object, propertyKey: string | symbol): void {
		const properties: SerializableProperty[] = Reflect.getMetadata(serializableKey, target);
		const metaData = { propertyKey: propertyKey as string, size, options };
		if (properties) {
			properties.push(metaData);
		} else {
			Reflect.defineMetadata(serializableKey, [metaData], target);
		}
	};
}

function getSerializableProperties(target: object): SerializableProperty[] | undefined {
	return Reflect.getMetadata(serializableKey, target) as SerializableProperty[];
}

function readNumber(
	dataView: DataView,
	byteOffset: number,
	size: number,
	isSigned: boolean,
	isFloat: boolean
): number {
	switch (size) {
		case 1:
			return isSigned
				? dataView.getInt8(byteOffset)
				: dataView.getUint8(byteOffset);
		case 2:
			return isSigned
				? dataView.getInt16(byteOffset, true)
				: dataView.getUint16(byteOffset, true);
		case 4:
			return isFloat
				? dataView.getFloat32(byteOffset, true)
				: isSigned
					? dataView.getInt32(byteOffset, true)
					: dataView.getUint32(byteOffset, true);
		case 8:
			if (isFloat) {
				return dataView.getFloat64(byteOffset, true);
			} else {
				throw new SerializationError("BigInt not supported");
			}
		default:
			throw new SerializationError(
        `Invalid property size, got ${size} but expected 1, 2, 4, or 8`
			);
	}
}

function findNullIndex(dataView: DataView, byteOffset: number): number {
	for (let i = byteOffset; i < dataView.byteLength; ++i) {
		if (!dataView.getUint8(i)) {
			return i;
		}
	}
	throw new SerializationError("Data is not null terminated");
}

function internalDeserialize<T extends object>(
	objOrArray: T | T[],
	dataView: DataView,
	opt?: { allowSkipLastProps?: boolean }
): number {
	function setProp(
		obj: object,
		prop: SerializableProperty,
		value: any,
		prevValue: any
	) {
		if (
			typeof prevValue === "boolean" &&
      (typeof value === "number" || typeof value === "bigint")
		) {
			// Convert number to boolean
			value = Boolean(value);
		} else if (typeof value !== typeof prevValue) {
			throw new SerializationError(
        `Type mismatch, deserialized a ${typeof value} but but expected a ${typeof prevValue}`
			);
		}
		(obj as any)[prop.propertyKey] = value;
	}
	let byteOffset = 0;
	forEachSerializableProp(objOrArray, (prop, value) => {
		if (opt?.allowSkipLastProps && byteOffset === dataView.byteLength) {
			// Stop if we exactly reached the end of the buffer
			return false; // Stop iterating props
		} else if (
			!prop.options?.nullTerminated &&
      !prop.options?.terminator &&
      byteOffset + prop.size > dataView.byteLength
		) {
			// Not enough data left
			throw new SerializationError(
        `Not enough bytes for deserializing \`${prop.propertyKey}\` of size ${prop.size}`
			);
		}
		// Check type
		if (Array.isArray(objOrArray)) {
			// Arrays not supported
			throw new SerializationError(
				"Array type not supported for deserialization"
			);
		} else if (typeof value === "string") {
			// Read string
			const begin = dataView.byteOffset + byteOffset;
			if (
				!prop.options?.nullTerminated &&
        !prop.options?.terminator &&
        begin + prop.size > dataView.buffer.byteLength
			) {
				throw new SerializationError(
          `Unexpected property size, got ${prop.size} but there are only ${
            dataView.buffer.byteLength - begin
          } left`
				);
			}
			const strArr = dataView.buffer.slice(
				begin,
				prop.options?.nullTerminated
					? findNullIndex(dataView, byteOffset) - 1
					: prop.options?.terminator
						? dataView.byteOffset + dataView.byteLength
						: begin + prop.size
			);
			try {
				setProp(objOrArray, prop, decodeUtf8(new Uint8Array(strArr)), value);
			} catch (error: any) {
				if (error instanceof DecodeUtf8Error) {
					// Go on with what we have
					setProp(objOrArray, prop, error.decodedString, value);
					console.warn(
            `Error decoding string for \`${prop.propertyKey}\`: ${error}`
					);
				} else {
					throw new SerializationError(error?.message ?? String(error));
				}
			}
			byteOffset += strArr.byteLength;
		} else {
			// Read number
			const isFloat = prop.options?.numberFormat === "float";
			const isSigned = prop.options?.numberFormat === "signed";
			const newValue = readNumber(
				dataView,
				byteOffset,
				prop.size,
				isSigned,
				isFloat
			);
			setProp(objOrArray, prop, newValue, value);
			byteOffset += prop.size;
		}
		byteOffset += prop.options?.padding ?? 0;
		return true; // Continue
	});
	return byteOffset;
}

function deserialize<T extends object>(
	obj: T,
	dataView: DataView,
	opt?: { allowSkipLastProps?: boolean }
): number {
	return internalDeserialize(obj, dataView, opt);
}

function forEachSerializableProp(
	obj: object,
	callback: (prop: SerializableProperty, value: any) => boolean
) {
	const props = getSerializableProperties(obj);
	if (!props?.length) {
		throw new SerializationError("Object has no serializable property");
	}
	for (const prop of props) {
		const value = (obj as any)[prop.propertyKey];
		const isBuffer =
      value instanceof ArrayBuffer ||
      (value && value.buffer instanceof ArrayBuffer);
		if (
			typeof value !== "number" &&
			typeof value !== "bigint" &&
			typeof value !== "boolean" &&
			typeof value !== "string" &&
			!isBuffer
		) {
			throw new SerializationError(
				Array.isArray(value)
					? "Invalid property type, got an array, use an 'ArrayBuffer' instead"
					: `Invalid property type, got ${typeof value} for ${
              prop.propertyKey
            } but expected number or bigint`
			);
		}
		if (!callback(prop, value)) {
			break;
		}
	}
}

interface PixelMessage {
	readonly type: number;
}

class GenericPixelMessage implements PixelMessage {
	/** Type of the message. */
  	@serializable(1)
	readonly type: number;

  	constructor(type: number) {
  		this.type = type;
  	}
}
type MessageClass = new () => PixelMessage;
type MessageType = string;

class PixelMessageDeserializer {
	readonly _messageTypeValues: Readonly<Map<MessageType, number>>;
	readonly _messageClasses: readonly MessageClass[];
	readonly _messageNamesLookup: readonly MessageType[] = [];
	readonly _reverseMsgClassesLookup: Readonly<Map<MessageClass, number>> =
		new Map();
	readonly _messageClassesLookup: Readonly<Map<number, MessageClass>> =
		new Map();

	constructor(messageTypeValues: readonly [MessageType, number][], messageClasses: readonly MessageClass[]) {
		this._messageTypeValues = new Map(messageTypeValues);
		this._messageClasses = messageClasses;
	}

	public deserializeMessage(dataView: DataView): MessageType | PixelMessage {
		if (!dataView.byteLength) {
			throw new SerializationError("Can't deserialize an empty buffer");
		}
		const msgTypeValue = dataView.getUint8(0);
		if (dataView.byteLength === 1) {
			return this.getMessageType(msgTypeValue);
		} else {
			const msg = this.instantiateMessage(this.getMessageType(msgTypeValue));
			const allowSkipLastProps =
        "allowSkipLastProps" in msg.constructor &&
        msg.constructor.allowSkipLastProps === true;
			const bytesRead = deserialize(msg, dataView, { allowSkipLastProps });
			if (bytesRead !== dataView.byteLength) {
				console.warn(
          `The last ${
            dataView.byteLength - bytesRead
          } bytes were not read while deserializing message of type ${msg.type}`
				);
			}
			assert(
				msg.type === msgTypeValue,
        `Incorrect message type after deserializing ${msg.type} but expecting ${msgTypeValue}`
			);
			return msg;
		}
	}

	public getMessageType(
		msgOrTypeOrTypeValue: MessageType | PixelMessage | number
	): MessageType {
		if (typeof msgOrTypeOrTypeValue === "string") {
			return msgOrTypeOrTypeValue;
		} else {
			const typeValue =
        typeof msgOrTypeOrTypeValue === "number"
        	? msgOrTypeOrTypeValue
        	: msgOrTypeOrTypeValue.type;
			const type = this._getMessageNameFromValue(typeValue);
			if (type) {
				return type;
			}
			throw Error(
        `getMessageName: ${typeValue} is not a value in MessageTypeValues`
			);
		}
	}

	private _getMessageNameFromValue(typeValue: number): MessageType | undefined {
		if (!this._messageNamesLookup.length) {
			const lookup = this._messageNamesLookup as MessageType[];
			for (const [key, value] of this._messageTypeValues) {
				lookup[value] = key as MessageType;
			}
		}
		return this._messageNamesLookup[typeValue];
	}

	private instantiateMessage(type: MessageType): PixelMessage {
		const typeValue = this._checkGetMessageTypeValue(type);
		const ctor = this._getMessageClass(typeValue);
		if (ctor) {
			return new ctor();
		} else {
			return new GenericPixelMessage(typeValue);
		}
	}

	private _checkGetMessageTypeValue(msgType: MessageType): number {
		const typeValue = this._messageTypeValues.get(msgType);
		assert(typeValue, `No Pixel message type value for ${msgType}`);
		return typeValue;
	}

	private _getMessageClass(msgTypeValue: number): MessageClass | undefined {
		if (!this._messageClassesLookup.size) {
			const lookup = this._messageClassesLookup as Map<number, MessageClass>;
			for (const ctor of this._messageClasses) {
				lookup.set(new ctor().type, ctor);
			}
		}
		return this._messageClassesLookup.get(msgTypeValue);
	}
}

let _enumValue = 0;
function enumValue(initialValue?: number): number {
	if (initialValue !== undefined) {
		_enumValue = initialValue;
	}
	return _enumValue++;
}

const PixelBatteryStateValues = {
	ok: enumValue(0),
	low: enumValue(),
	charging: enumValue(),
	done: enumValue(),
	badCharging: enumValue(),
	error: enumValue(),
} as const;

const PixelRollStateValues = {
	unknown: enumValue(0),
	rolled: enumValue(),
	handling: enumValue(),
	rolling: enumValue(),
	crooked: enumValue(),
	onFace: enumValue(),
} as const;

const PixelColorwayValues = {
	unknown: enumValue(0),
	onyxBlack: enumValue(),
	hematiteGrey: enumValue(),
	midnightGalaxy: enumValue(),
	auroraSky: enumValue(),
	clear: enumValue(),
	whiteAurora: enumValue(),
	custom: 0xff,
} as const;

const PixelDieTypeValues = {
	unknown: enumValue(0),
	d4: enumValue(),
	d6: enumValue(),
	d8: enumValue(),
	d10: enumValue(),
	d00: enumValue(),
	d12: enumValue(),
	d20: enumValue(),
	d6pipped: enumValue(),
	d6fudge: enumValue(),
} as const;

export class LegacyIAmADie implements PixelMessage {
  /** Type of the message. */
  @serializable(1)
	readonly type = MessageTypeValues.iAmADie;

  /** Number of LEDs. */
  @serializable(1)
  	ledCount = 0;

  /** Die color. */
  @serializable(1)
  	colorway = PixelColorwayValues.unknown;

  /** Type of die. */
  @serializable(1)
  	dieType = PixelDieTypeValues.unknown;

  /** Hash of the uploaded profile. */
  @serializable(4)
  	dataSetHash = 0;

  /** The unique Pixel id. */
  @serializable(4)
  	pixelId = 0;

  /** Amount of available flash. */
  @serializable(2)
  	availableFlashSize = 0;

  /** UNIX timestamp in seconds for the date of the firmware. */
  @serializable(4)
  	buildTimestamp = 0;

  // Roll state

  /** Current roll state. */
  @serializable(1)
  	rollState = PixelRollStateValues.unknown;

  /** Index of the face that is currently facing up. */
  @serializable(1)
  	currentFaceIndex = 0;

  // Battery level

  /** The battery charge level in percent. */
  @serializable(1)
  	batteryLevelPercent = 0;

  /** The charging state of the battery. */
  @serializable(1)
  	batteryState = PixelBatteryStateValues.ok;

  /** Byte size of the LegacyIAmADie message. */
  static readonly expectedSize = 22;
}

export class RollState implements PixelMessage {
	/** Type of the message. */
	@serializable(1)
	readonly type = MessageTypeValues.rollState;

	/** Current roll state. */
	@serializable(1)
  	state = PixelRollStateValues.unknown;

	/** Index of the face facing up (if applicable). */
	@serializable(1)
  	faceIndex = 0;
}

export class BatteryLevel implements PixelMessage {
  	/** Type of the message. */
  	@serializable(1)
	readonly type = MessageTypeValues.batteryLevel;

  	/** The battery charge level in percent. */
  	@serializable(1)
  	levelPercent = 0;

  	/** The charging state of the battery. */
  	@serializable(1)
  	state = PixelBatteryStateValues.ok;
}

const MessageTypeValues = {
	none: enumValue(0),
	whoAreYou: enumValue(),
	iAmADie: enumValue(),
	rollState: enumValue(),
	telemetry: enumValue(),
	bulkSetup: enumValue(),
	bulkSetupAck: enumValue(),
	bulkData: enumValue(),
	bulkDataAck: enumValue(),
	transferAnimationSet: enumValue(),
	transferAnimationSetAck: enumValue(),
	transferAnimationSetFinished: enumValue(),
	transferSettings: enumValue(),
	transferSettingsAck: enumValue(),
	transferSettingsFinished: enumValue(),
	_unused1: enumValue(),
	_unused2: enumValue(),
	_unused3: enumValue(),
	debugLog: enumValue(),
	playAnimation: enumValue(),
	playAnimationEvent: enumValue(),
	stopAnimation: enumValue(),
	remoteAction: enumValue(),
	requestRollState: enumValue(),
	requestAnimationSet: enumValue(),
	requestSettings: enumValue(),
	requestTelemetry: enumValue(),
	programDefaultAnimationSet: enumValue(),
	programDefaultAnimationSetFinished: enumValue(),
	blink: enumValue(),
	blinkAck: enumValue(),
	requestDefaultAnimationSetColor: enumValue(),
	defaultAnimationSetColor: enumValue(),
	requestBatteryLevel: enumValue(),
	batteryLevel: enumValue(),
	requestRssi: enumValue(),
	rssi: enumValue(),
	calibrate: enumValue(),
	calibrateFace: enumValue(),
	notifyUser: enumValue(),
	notifyUserAck: enumValue(),
	testHardware: enumValue(),
	storeValue: enumValue(),
	storeValueAck: enumValue(),
	setTopLevelState: enumValue(),
	programDefaultParameters: enumValue(),
	programDefaultParametersFinished: enumValue(),
	setDesignAndColor: enumValue(),
	setDesignAndColorAck: enumValue(),
	setCurrentBehavior: enumValue(),
	setCurrentBehaviorAck: enumValue(),
	setName: enumValue(),
	setNameAck: enumValue(),
	powerOperation: enumValue(),
	exitValidation: enumValue(),
	transferInstantAnimationSet: enumValue(),
	transferInstantAnimationSetAck: enumValue(),
	transferInstantAnimationSetFinished: enumValue(),
	playInstantAnimation: enumValue(),
	stopAllAnimations: enumValue(),
	requestTemperature: enumValue(),
	temperature: enumValue(),
	setBatteryControllerMode: enumValue(),
	_unused4: enumValue(),
	discharge: enumValue(),
	blinkId: enumValue(),
	blinkIdAck: enumValue(),
	transferTest: enumValue(),
	transferTestAck: enumValue(),
	transferTestFinished: enumValue(),
	clearSettings: enumValue(),
	clearSettingsAck: enumValue(),

	// Testing
	testBulkSend: enumValue(),
	testBulkReceive: enumValue(),
	setAllLEDsToColor: enumValue(),
	attractMode: enumValue(),
	printNormals: enumValue(),
	printA2DReadings: enumValue(),
	lightUpFace: enumValue(),
	setLEDToColor: enumValue(),
	printAnimationControllerState: enumValue(),
} as const;

export const serializer = new PixelMessageDeserializer(Object.entries(MessageTypeValues) as [MessageType, number][],
	[
		LegacyIAmADie,
		RollState,
		BatteryLevel,
	]);