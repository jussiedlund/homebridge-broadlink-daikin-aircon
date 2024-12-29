const base64 = require('base64-js');




class DaikinAircon {
    // static FRAME_1_LENGTH = 8;
    // static FRAME_2_LENGTH = 8;
    // static FRAME_3_LENGTH = 19;


    static FAN_SPEEDS = { AUTO: 10, QUIET: 11, LEVEL1: 3, LEVEL2: 4, LEVEL3: 5, LEVEL4: 6, LEVEL5: 7 };
    static AC_MODES = { AUTO: 0, COOL: 3, DRY: 2, HEAT: 4, FAN: 6 };
    static POWER = { ON: 1, OFF: 0 }

    static PULSE_LENGTH = 522
    static SPACE_ONE_LENGTH = 1400
    static SPACE_ZERO_LENGTH = 420
    static SPACE_POST_LONG_PULSE_LENGTH = 1770
    static PULSE_LONG_LENGTH = 3490
    static SPACE_LONG_LENGTH = 26800
    static SPACE_HUGE_LENGTH = 37150
    static SPACE_END = 200000

    constructor() {
        this.power = false;
        this.temperature = 24;
        this.fanSpeed = DaikinAircon.FAN_SPEEDS.LEVEL2;
        this.mode = DaikinAircon.AC_MODES.COOL;
        this.comfortMode = false;
        this.powerfulMode = false;
        this.silentMode = false;
        this.econoMode = false;
        this.sensorMode = false;
        this.timer = false;
        this.verticalSwing = false;
        this.horizontalSwing = false;
    }

    getCode() {
        return this.generateDaikinCode();
    }

    getBroadlinkCode() {
        const hexCode = this.getCode();
        const rawTimings = this.hexToRawData(hexCode);
        try {
            const broadlinkData = this.wrapForBroadlink(rawTimings);
            const base64Data = Buffer.from(broadlinkData).toString('base64');
            return base64Data;
        } catch (error) {
            console.error('Error wrapping Broadlink data:', error.message);
        }
    }
    computeChecksum(frame) {
		var cs = 0;
		
		for(var i = 0; i < frame.length; i++) {
			cs += frame[i];
		}
		return (cs & 0x00ff);
	}

    buildSignal(data) {
        const signal = [];
        for (const byte of data) {
            for (let bit = 0; bit < 8; bit++) {
                const isOne = (byte >> bit) & 1;
                signal.push(
                    DaikinAircon.DAIKIN_ONE_MARK,
                    isOne ? DaikinAircon.DAIKIN_ONE_SPACE : DaikinAircon.DAIKIN_ZERO_SPACE
                );
            }
        }
        return signal;
    }

    buildFrame1() {
        const frame = [0x11, 0xda, 0x27, 0x00, 0xc5, 0x10, 0x00, 0xe7];
        return frame;
    }

    buildFrame2() {
        const frame = [0x11, 0xda, 0x27, 0x00, 0x42, 0xfc, 0x24, 0x74]
        return frame;
    }

    buildFrame3() {
        const frame = [0x11, 0xda, 0x27, 0x00, 0x00];
        frame[5] = (this.power ? 0x01 : 0x00) | 0x08 | (this.mode << 4);
//        frame[5] = this.power | 0x08 | (this.mode << 4)
//        frame[5] = this.power ? 1 : 0;
        frame[6] = this.temperature << 1
        frame[7] = 0x00;
        frame[8] = (this.verticalSwing ? 0x0F : 0x00) | (this.fanSpeed << 4);
        frame[9] = (this.horizontalSwing ? 0x0F : 0x00);
        frame[10] = 0x00;
        frame[11] = 0x06;
        frame[12] = 0x60;
        frame[13] = this.powerfulMode | this.silentMode << 5;
        frame[14] = 0x00;
        frame[15] = 0xC1;
        frame[16] = 0x80 | this.sensorMode << 1 | this.econoMode << 2
        frame[17] = 0x00;
        frame[18] = this.computeChecksum(frame);
        return frame;

    }



    generateDaikinCode() {
        const frame1 = this.buildFrame1();
        const frame2 = this.buildFrame2();
        const frame3 = this.buildFrame3();
        const fullCode = [...frame1, ...frame2, ...frame3];
        return fullCode.map((byte) => byte.toString(16).padStart(2, '0')).join('');
    }

    byteToDurations(bt) {
        const result = [];
        // Convert the byte to an 8-bit binary string and reverse it
        const strBits = bt.toString(2).padStart(8, '0').split('').reverse().join('');

        for (const b of strBits) {
            if (b === '0') {
                result.push(DaikinAircon.SPACE_ZERO_LENGTH);
            } else {
                result.push(DaikinAircon.SPACE_ONE_LENGTH);
            }
            // Append the pulse length for every bit
            result.push(DaikinAircon.PULSE_LENGTH);
        }

        return result;
    }

    frameToDurations(frame) {
        var result = []
        for (const byte of frame) {
            result.push(...this.byteToDurations(byte))
        }
        return result;
    }

    createDaikinCodeForSending() {

        var result = [];
        result.push(DaikinAircon.PULSE_LENGTH)
        for (var i=0;i<5;i++) {
            result.push(DaikinAircon.SPACE_ZERO_LENGTH)
            result.push(DaikinAircon.PULSE_LENGTH)
        }
        result.push(DaikinAircon.SPACE_LONG_LENGTH)
        result.push(DaikinAircon.PULSE_LONG_LENGTH)
        result.push(DaikinAircon.SPACE_POST_LONG_PULSE_LENGTH)
        result.push(DaikinAircon.PULSE_LENGTH)
        result.push(...this.frameToDurations(this.buildFrame1()))
        result.push(DaikinAircon.SPACE_HUGE_LENGTH)
        result.push(DaikinAircon.PULSE_LONG_LENGTH)
        result.push(DaikinAircon.SPACE_POST_LONG_PULSE_LENGTH)
        result.push(DaikinAircon.PULSE_LENGTH)
        result.push(...this.frameToDurations(this.buildFrame2()))
        result.push(DaikinAircon.SPACE_HUGE_LENGTH)
        result.push(DaikinAircon.PULSE_LONG_LENGTH)
        result.push(DaikinAircon.SPACE_POST_LONG_PULSE_LENGTH)
        result.push(DaikinAircon.PULSE_LENGTH)
        result.push(...this.frameToDurations(this.buildFrame3()))
        result.push(DaikinAircon.SPACE_END)


        return result
    }
}

module.exports = { DaikinAircon };
