export interface RollEvent {
    type: number;
    state: number;
    faceIndex: number;
}

export interface BatteryEvent {
    type: number;
    state: number;
    levelPercent: number;
}

export interface RollStateListener {
    actionId: string;
    type: "rollState";
    listener: (event: RollEvent) => Promise<void>;
}

export interface BatteryStateListener {
    actionId: string;
    type: "batteryLevel";
    listener: (event: BatteryEvent) => Promise<void>;
}

export type Listener = BatteryStateListener | RollStateListener;
