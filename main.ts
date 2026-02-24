/**
 * Grove DHT22 (Temperature & Humidity Sensor Pro) - micro:bit MakeCode extension
 * - Protocole single-bus DHT22 (timing µs)
 * - Checksum
 * - Cache 2s
 * - Dropdown "Port BitMaker V2"
 */

//% color=#2F5597 icon="\uf2c9" block="Grove DHT22"
namespace groveDHT22 {

    export enum DHT22Data {
        //% block="température (°C)"
        TemperatureC = 0,
        //% block="humidité (%RH)"
        Humidity = 1
    }

    export enum BitMakerPort {
        //% block="P0 / P1"
        P0_P1 = 0,
        //% block="P1 / P2"
        P1_P2 = 1,
        //% block="P2 / P12"
        P2_P12 = 2,
        //% block="P8 / P14"
        P8_P14 = 3,
        //% block="P15 / P16"
        P15_P16 = 4
    }

    let lastReadMs = -999999
    let lastTempC = NaN
    let lastHum = NaN
    let lastOk = false

    const MIN_INTERVAL_MS = 2000

    function portToDataPin(port: BitMakerPort): DigitalPin {
        switch (port) {
            case BitMakerPort.P0_P1: return DigitalPin.P0
            case BitMakerPort.P1_P2: return DigitalPin.P1
            case BitMakerPort.P2_P12: return DigitalPin.P2
            case BitMakerPort.P8_P14: return DigitalPin.P8
            case BitMakerPort.P15_P16: return DigitalPin.P15
            default: return DigitalPin.P0
        }
    }

    function readOnce(pin: DigitalPin): boolean {
        pins.digitalWritePin(pin, 0)
        basic.pause(2)
        pins.digitalWritePin(pin, 1)
        control.waitMicros(30)

        pins.digitalReadPin(pin)
        pins.setPull(pin, PinPullMode.PullUp)

        let tLow = pins.pulseIn(pin, PulseValue.Low, 2000)
        let tHigh = pins.pulseIn(pin, PulseValue.High, 2000)
        if (tLow == 0 || tHigh == 0) return false

        let data: number[] = [0, 0, 0, 0, 0]

        for (let i = 0; i < 40; i++) {
            let lowPulse = pins.pulseIn(pin, PulseValue.Low, 2000)
            let highPulse = pins.pulseIn(pin, PulseValue.High, 2000)
            if (lowPulse == 0 || highPulse == 0) return false

            let bit = (highPulse > 50) ? 1 : 0

            let byteIndex = Math.idiv(i, 8)
            let bitIndex = 7 - (i % 8)
            if (bit) data[byteIndex] |= (1 << bitIndex)
        }

        let sum = (data[0] + data[1] + data[2] + data[3]) & 0xFF
        if (sum != data[4]) return false

        let rawHum = (data[0] << 8) | data[1]
        let hum = rawHum / 10.0

        let rawTemp = ((data[2] & 0x7F) << 8) | data[3]
        let temp = rawTemp / 10.0
        if (data[2] & 0x80) temp = -temp

        if (hum < 0 || hum > 100) return false
        if (temp < -40 || temp > 80) return false

        lastHum = hum
        lastTempC = temp
        return true
    }

    function ensureFresh(pin: DigitalPin): void {
        let now = control.millis()
        if (now - lastReadMs < MIN_INTERVAL_MS && lastOk) return
        lastReadMs = now
        lastOk = readOnce(pin)
    }

    //% block="lire DHT22 %what|sur broche %pin"
    export function read(pin: DigitalPin, what: DHT22Data): number {
        ensureFresh(pin)
        if (!lastOk) return NaN
        return (what == DHT22Data.TemperatureC) ? lastTempC : lastHum
    }

    //% block="lire DHT22 %what|sur port BitMaker %port"
    export function readOnPort(port: BitMakerPort, what: DHT22Data): number {
        const pin = portToDataPin(port)
        return read(pin, what)
    }

    //% block="mesure DHT22 valide sur %pin"
    export function ok(pin: DigitalPin): boolean {
        ensureFresh(pin)
        return lastOk
    }

    //% block="forcer mesure DHT22 sur %pin"
    export function force(pin: DigitalPin): void {
        lastReadMs = -999999
        ensureFresh(pin)
    }
}
