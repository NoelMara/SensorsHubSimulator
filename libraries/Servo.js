// libraries/Servo.js

class ServoLibrary {
  constructor() {
    this._pin = null;
    this._component = null;
    this._angle = 90;
  }

  _findComp() {
    // Always re-query so it works even if wired after attach()
    if (this._pin === null) return null;

    // Try via global findConnectedComponent first (exact pin match)
    if (typeof globalThis.findConnectedComponent === 'function') {
      const c = globalThis.findConnectedComponent('servo', 'PWM', this._pin);
      if (c) return c;
    }

    // Fallback: any wired servo on canvas
    if (typeof components !== 'undefined' && typeof isComponentWired === 'function') {
      for (const c of components) {
        if (c.type === 'servo' && isComponentWired(c)) return c;
      }
    }

    // Last resort: any servo at all
    if (typeof components !== 'undefined') {
      for (const c of components) {
        if (c.type === 'servo') return c;
      }
    }

    return null;
  }

  _findExactComp() {
    if (this._pin === null) return null;

    if (typeof globalThis.findConnectedComponent === 'function') {
      return globalThis.findConnectedComponent('servo', 'PWM', this._pin);
    }

    return null;
  }

  _throwTryWiringError() {
    if (
      typeof simulatorTryCatchDepth === 'undefined' ||
      simulatorTryCatchDepth <= 0 ||
      typeof findComponentWiringIssue !== 'function' ||
      typeof throwComponentWiringError !== 'function' ||
      typeof getComponentLabel !== 'function'
    ) {
      return;
    }

    const issue = findComponentWiringIssue('servo', 'PWM', this._pin);
    if (issue) {
      throwComponentWiringError(getComponentLabel(issue.comp), issue.detail);
    }
  }

  attach(pin) {
    this._pin = typeof pin === 'number' ? pin : parseInt(pin, 10) || 0;
    this._component = this._findComp();
    console.log('[Servo] attach(pin=' + this._pin + ') — comp:', this._component ? this._component.id : 'not found');
  }

  write(angle) {
    this._angle = Math.min(180, Math.max(0, Number(angle) || 0));
    if (!this._findExactComp()) this._throwTryWiringError();
    this._component = this._findComp(); // re-query every write
    console.log('[Servo] write(' + this._angle + '°) — comp:', this._component ? this._component.id : 'not found');

    if (this._component && this._component.state) {
      this._component.state.angle = this._angle;
      if (typeof draw === 'function') draw();
    }
  }

  writeMicroseconds(us) {
    // Convert microseconds (500-2400) to degrees (0-180)
    const angle = Math.round((us - 500) / (2400 - 500) * 180);
    this.write(angle);
  }

  read() {
    return this._angle;
  }

  attached() {
    return this._pin !== null;
  }

  detach() {
    this._pin = null;
    this._component = null;
  }
}

if (typeof libraryRegistry !== 'undefined') {
  // Register under BOTH header names so both #include <Servo.h>
  // and #include <ESP32Servo.h> are recognized
  libraryRegistry.registerLibrary('Servo', ServoLibrary, {
    headerFile: 'Servo.h',
    // Matches: "Servo myServo;" (no parens) AND "Servo myServo();"
    constructorRegex: /^Servo\s+(\w+)\s*(?:\(\s*\))?\s*;?$/
  });

  // Register a second entry for ESP32Servo.h with same class
  libraryRegistry.registerLibrary('ESP32Servo', ServoLibrary, {
    headerFile: 'ESP32Servo.h',
    constructorRegex: /^Servo\s+(\w+)\s*(?:\(\s*\))?\s*;?$/
  });
} else {
  console.error('[Servo] libraryRegistry not found — Servo library NOT registered!');
}
