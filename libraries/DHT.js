// libraries/DHT.js

class DHTLibrary {
  constructor(pin, type) {
    this._pin = (typeof pin === 'number') ? pin : parseInt(pin, 10);
    if (Number.isNaN(this._pin)) this._pin = null;
    this._type = type || 'DHT22';
    this._initialized = false;
    this._lastTemp = NaN;
    this._lastHum = NaN;
  }

  _resolveComp() {
    if (this._pin === null || this._pin === undefined) {
      return null;
    }

    if (typeof globalThis.findConnectedComponent === 'function') {
      const c = globalThis.findConnectedComponent('dht', 'Data', this._pin);
      if (c) return c;
    }

    return null;
  }

  begin() {
    const comp = this._resolveComp();
    this._initialized = !!comp;
    return this._initialized;
  }

  readTemperature(fahrenheit) {
    const comp = this._resolveComp();
    if (comp && comp.state && typeof comp.state.temperature === 'number') {
      const temp = comp.state.temperature;
      this._lastTemp = temp;
      return fahrenheit ? temp * 9.0 / 5.0 + 32.0 : temp;
    }

    return NaN;
  }

  readHumidity() {
    const comp = this._resolveComp();
    if (comp && comp.state && typeof comp.state.humidity === 'number') {
      const hum = comp.state.humidity;
      this._lastHum = hum;
      return hum;
    }

    return NaN;
  }

  computeHeatIndex(temp, hum, fahrenheit) {
    if (typeof temp !== 'number' || typeof hum !== 'number') return NaN;
    if (Number.isNaN(temp) || Number.isNaN(hum)) return NaN;

    var isFahrenheit = fahrenheit !== false;
    var t = isFahrenheit ? temp : (temp * 9.0 / 5.0 + 32.0);
    var h = hum;

    var hi = -42.379 +
      2.04901523 * t +
      10.14333127 * h -
      0.22475541 * t * h -
      0.00683783 * t * t -
      0.05481717 * h * h +
      0.00122874 * t * t * h +
      0.00085282 * t * h * h -
      0.00000199 * t * t * h * h;

    if (h < 13 && t >= 80 && t <= 112) {
      hi -= ((13 - h) * 0.25) * Math.sqrt((17 - Math.abs(t - 95)) / 17);
    } else if (h > 85 && t >= 80 && t <= 87) {
      hi += ((h - 85) * 0.1) * ((87 - t) * 0.2);
    }

    return isFahrenheit ? hi : (hi - 32.0) * 5.0 / 9.0;
  }
}

if (typeof libraryRegistry !== 'undefined') {
  libraryRegistry.registerLibrary('DHT', DHTLibrary, {
    headerFile: 'DHT.h',
    constructorRegex: /DHT\s+(\w+)\s*\((.*)\)\s*;?$/
  });
}
