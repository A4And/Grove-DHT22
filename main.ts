/**
 * Grove DHT22 (Temperature & Humidity Sensor Pro) - micro:bit MakeCode extension
 * - Protocole single-bus DHT22 (timing µs)
 * - Checksum
 * - Cache 2s (respect période mini d'acquisition)
 * - Dropdown BitMaker V2 avec choix explicite de la broche DATA
 */

//% color=#2F5597 icon="\uf2c9" block="Grove DHT22"
namespace groveDHT22 {

    export enum DHT22Data {
        //% block="température (°C)"
        TemperatureC = 0,
        //% block="humidité (%RH)"
        Humidity = 1
    }

    /**
     * Sélection explicite de la broche DATA sur les ports Grove "doubles" du BitMaker V2.
     * Le DHT22 n’utilise qu’1 fil DATA.
     */
    export enum BitMakerPortData {
        //% block="P0 / P1 (DATA = P0)"
        P0P1_DataP0 = 0,
        //% block="P0 / P1 (DATA = P1)"
        P0P1_DataP1 = 1,

        //% block="P1 / P2 (DATA = P1)"
        P1P2_DataP1 = 2,
        //% block="P1 / P2 (DATA = P2)"
        P1P2_DataP2 = 3,

        //% block="P2 / P12 (DATA = P2)"
        P2P12_DataP2 = 4,
        //% block="P2 / P12 (DATA = P12)"
        P2P12_DataP12 = 5,

        //% block="P8 / P14 (DATA = P8)"
        P8P14_DataP8 = 6,
        //% block="P8 / P14 (DATA = P14)"
        P8P14_DataP14 = 7,

        //% block="P15 / P16 (DATA = P15)"
        P15P16_DataP15 = 8,
        //% block="P15 / P16 (DATA = P16)"
        P15P16_DataP16 = 9
    }

    function portDataToPin(sel: BitMakerPortData): DigitalPin {
        switch (sel) {
            case BitMakerPortData.P0P1_DataP0: return DigitalPin.P0
            case BitMakerPortData.P0P1_DataP1: return DigitalPin.P1

            case BitMakerPortData.P1P2_DataP1: return DigitalPin.P1
            case BitMakerPortData.P1P2_DataP2: return DigitalPin.P2

            case BitMakerPortData.P2P12_DataP2: return DigitalPin.P2
            case BitMakerPortData.P2P12_DataP12: return DigitalPin.P12

            case BitMakerPortData.P8P14_DataP8: return DigitalPin.P8
            case BitMakerPortData.P8P14_DataP14: return DigitalPin.P14

            case BitMakerPortData.P15P16_DataP15: return DigitalPin.P15
            case BitMakerPortData.P15P16_DataP16: return DigitalPin.P16

            default: return DigitalPin.P0
        }
    }

    // Cache global
    let lastReadMs = -999999
    let lastTempC = NaN
    let lastHum = NaN
    let lastOk = false

    const MIN_INTERVAL_MS = 2000          // DHT22 : une mesure toutes ~2s max
    const PULSE_TIMEOUT_US = 2500         // timeout pulses (µs), protège contre blocage

    function readOnce(pin: DigitalPin): boolean {
        // Start signal : LOW >= 1ms
        pins.digitalWritePin(pin, 0)
        basic.pause(2) // ms

        // Puis HIGH 20-40µs
        pins.digitalWritePin(pin, 1)
        control.waitMicros(30)

        // Relâche la ligne : input + pull-up
        pins.digitalReadPin(pin)
        pins.setPull(pin, PinPullMode.PullUp)

        // Réponse capteur : ~80µs LOW puis ~80µs HIGH
        let tLow = pins.pulseIn(pin, PulseValue.Low, PULSE_TIMEOUT_US)
        let tHigh = pins.pulseIn(pin, PulseValue.High, PULSE_TIMEOUT_US)
        if (tLow == 0 || tHigh == 0) return false

        // Lecture 40 bits = 5 octets
        let data: number[] = [0, 0, 0, 0, 0]

        for (let i = 0; i < 40; i++) {
            // chaque bit : 50µs LOW + HIGH (≈26-28µs => 0 ; ≈70µs => 1)
            let lowPulse = pins.pulseIn(pin, PulseValue.Low, PULSE_TIMEOUT_US)
            let highPulse = pins.pulseIn(pin, PulseValue.High, PULSE_TIMEOUT_US)
            if (lowPulse == 0 || highPulse == 0) return false

            let bit = (highPulse > 50) ? 1 : 0 // seuil simple entre ~28µs et ~70µs
            let byteIndex = Math.idiv(i, 8)
            let bitIndex = 7 - (i % 8)
            if (bit) data[byteIndex] |= (1 << bitIndex)
        }

        // Checksum
        let sum = (data[0] + data[1] + data[2] + data[3]) & 0xFF
        if (sum != data[4]) return false

        // Conversion
        // Humidité (16 bits) /10
        let rawHum = (data[0] << 8) | data[1]
        let hum = rawHum / 10.0

        // Température : bit signe + 15 bits magnitude /10
        let rawTemp = ((data[2] & 0x7F) << 8) | data[3]
        let temp = rawTemp / 10.0
        if (data[2] & 0x80) temp = -temp

        // Plages plausibles
        if (hum < 0 || hum > 100) return false
        if (temp < -40 || temp > 80) return false

        lastHum = hum
        lastTempC = temp
        return true
    }

    function ensureFresh(pin: DigitalPin): void {
        let now = control.millis()
        // Respect strict des 2 secondes, même si la lecture précédente était en erreur
        if (now - lastReadMs < MIN_INTERVAL_MS) return

        lastReadMs = now
        lastOk = readOnce(pin)
    }

    /**
     * Lire une donnée DHT22 sur une broche micro:bit.
     */
    //% block="lire DHT22 %what|sur broche %pin"
    export function read(pin: DigitalPin, what: DHT22Data): number {
        ensureFresh(pin)
        if (!lastOk) return NaN
        return (what == DHT22Data.TemperatureC) ? lastTempC : lastHum
    }

    /**
     * Lire une donnée DHT22 via BitMaker V2 (choix explicite DATA).
     */
    //% block="lire DHT22 %what|sur port BitMaker %sel"
    export function readOnBitMaker(sel: BitMakerPortData, what: DHT22Data): number {
        const pin = portDataToPin(sel)
        return read(pin, what)
    }

    /**
     * Indique si la dernière mesure est valide (checksum OK).
     */
    //% block="mesure DHT22 valide sur broche %pin"
    export function ok(pin: DigitalPin): boolean {
        ensureFresh(pin)
        return lastOk
    }

    //% block="mesure DHT22 valide sur port BitMaker %sel"
    export function okOnBitMaker(sel: BitMakerPortData): boolean {
        const pin = portDataToPin(sel)
        return ok(pin)
    }

    /**
     * Force une nouvelle mesure (en remettant lastReadMs loin dans le passé).
     */
    //% block="forcer mesure DHT22 sur broche %pin"
    export function force(pin: DigitalPin): void {
        lastReadMs = -999999
        ensureFresh(pin)
    }

    //% block="forcer mesure DHT22 sur port BitMaker %sel"
    export function forceOnBitMaker(sel: BitMakerPortData): void {
        const pin = portDataToPin(sel)
        force(pin)
    }
}
