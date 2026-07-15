// libraries/SSD1306.js

class SSD1306Library {
  constructor(...args) {
    this._width = 128;
    this._height = 64;
    this._address = 0x3C;

    if (args.length >= 1 && typeof args[0] === 'number') this._width = args[0];
    if (args.length >= 2 && typeof args[1] === 'number') this._height = args[1];

    this._display = this._createEmptyBuffer();
    this._cursorX = 0;
    this._cursorY = 0;
    this._textSize = 1;
    this._textColor = 1;
    this._component = null;
    this._initialized = false;
    this._expectedI2C = null;

    this._font = {
      '0':[0x3E,0x51,0x49,0x45,0x3E],'1':[0x00,0x42,0x7F,0x40,0x00],
      '2':[0x42,0x61,0x51,0x49,0x46],'3':[0x21,0x41,0x45,0x4B,0x31],
      '4':[0x18,0x14,0x12,0x7F,0x10],'5':[0x27,0x45,0x45,0x45,0x39],
      '6':[0x3C,0x4A,0x49,0x49,0x30],'7':[0x01,0x71,0x09,0x05,0x03],
      '8':[0x36,0x49,0x49,0x49,0x36],'9':[0x06,0x49,0x49,0x29,0x1E],
      'A':[0x7E,0x09,0x09,0x09,0x7E],'B':[0x7F,0x49,0x49,0x49,0x36],
      'C':[0x3E,0x41,0x41,0x41,0x22],'D':[0x7F,0x41,0x41,0x22,0x1C],
      'E':[0x7F,0x49,0x49,0x49,0x41],'F':[0x7F,0x09,0x09,0x09,0x01],
      'G':[0x3E,0x41,0x49,0x49,0x7A],'H':[0x7F,0x08,0x08,0x08,0x7F],
      'I':[0x00,0x41,0x7F,0x41,0x00],'J':[0x20,0x40,0x41,0x3F,0x01],
      'K':[0x7F,0x08,0x14,0x22,0x41],'L':[0x7F,0x40,0x40,0x40,0x40],
      'M':[0x7F,0x02,0x0C,0x02,0x7F],'N':[0x7F,0x04,0x08,0x10,0x7F],
      'O':[0x3E,0x41,0x41,0x41,0x3E],'P':[0x7F,0x09,0x09,0x09,0x06],
      'Q':[0x3E,0x41,0x51,0x21,0x5E],'R':[0x7F,0x09,0x19,0x29,0x46],
      'S':[0x26,0x49,0x49,0x49,0x32],'T':[0x01,0x01,0x7F,0x01,0x01],
      'U':[0x3F,0x40,0x40,0x40,0x3F],'V':[0x1F,0x20,0x40,0x20,0x1F],
      'W':[0x7F,0x20,0x18,0x20,0x7F],'X':[0x63,0x14,0x08,0x14,0x63],
      'Y':[0x03,0x04,0x78,0x04,0x03],'Z':[0x61,0x51,0x49,0x45,0x43],
      'a':[0x20,0x54,0x54,0x54,0x78],'b':[0x7F,0x48,0x44,0x44,0x38],
      'c':[0x38,0x44,0x44,0x44,0x20],'d':[0x38,0x44,0x44,0x48,0x7F],
      'e':[0x38,0x54,0x54,0x54,0x18],'f':[0x08,0x7E,0x09,0x01,0x02],
      'g':[0x0C,0x52,0x52,0x52,0x3E],'h':[0x7F,0x08,0x04,0x04,0x78],
      'i':[0x00,0x44,0x7D,0x40,0x00],'j':[0x20,0x40,0x40,0x3D,0x00],
      'k':[0x7F,0x10,0x28,0x44,0x00],'l':[0x00,0x41,0x7F,0x40,0x00],
      'm':[0x7C,0x04,0x18,0x04,0x78],'n':[0x7C,0x08,0x04,0x04,0x78],
      'o':[0x38,0x44,0x44,0x44,0x38],'p':[0x7C,0x14,0x14,0x14,0x08],
      'q':[0x08,0x14,0x14,0x18,0x7C],'r':[0x7C,0x08,0x04,0x04,0x08],
      's':[0x48,0x54,0x54,0x54,0x20],'t':[0x04,0x3F,0x44,0x40,0x20],
      'u':[0x3C,0x40,0x40,0x20,0x7C],'v':[0x1C,0x20,0x40,0x20,0x1C],
      'w':[0x3C,0x40,0x30,0x40,0x3C],'x':[0x44,0x28,0x10,0x28,0x44],
      'y':[0x0C,0x50,0x50,0x50,0x3C],'z':[0x44,0x64,0x54,0x4C,0x44],
      '!':[0x00,0x00,0x5F,0x00,0x00],'.':[0x00,0x60,0x60,0x00,0x00],
      ':':[0x00,0x36,0x36,0x00,0x00],' ':[0x00,0x00,0x00,0x00,0x00],
      '?':[0x02,0x01,0x51,0x09,0x06],'-':[0x00,0x08,0x08,0x08,0x00],
      '_':[0x00,0x40,0x40,0x40,0x40],'=':[0x00,0x14,0x14,0x14,0x00],
      '+':[0x00,0x08,0x3E,0x08,0x00],'/':[0x20,0x10,0x08,0x04,0x02],
      '\\':[0x02,0x04,0x08,0x10,0x20],'*':[0x2A,0x1C,0x3E,0x1C,0x2A],
    };
  }

  _createEmptyBuffer() {
    return Array.from({ length: 8 }, () => Array.from({ length: 128 }, () => 0));
  }

  _hasPinConnected(comp, pinName) {
    const targetPinId = comp.id + '_' + pinName;
    return wires.some(w => w.pin1Id === targetPinId || w.pin2Id === targetPinId);
  }

  _hasRequiredConnections(comp) {
    const required = ['GND', 'VCC', 'SCL', 'SDA'];
    return required.every(pinName => this._hasPinConnected(comp, pinName));
  }

  _pinIdMatchesName(pinId, pinName) {
    return typeof pinId === 'string' && typeof pinName === 'string' && pinId.endsWith('_' + pinName);
  }

  _isPinConnectedToMcu(comp, pinName, expectedPinNumber) {
    if (expectedPinNumber === null || expectedPinNumber === undefined) return false;
    if (typeof mcuPinName !== 'function') return false;

    const expectedPinName = mcuPinName(expectedPinNumber);
    const targetPinId = comp.id + '_' + pinName;

    return wires.some(w =>
      (w.pin1Id === targetPinId && this._pinIdMatchesName(w.pin2Id, expectedPinName)) ||
      (w.pin2Id === targetPinId && this._pinIdMatchesName(w.pin1Id, expectedPinName))
    );
  }

  _clearComponentDisplay(comp) {
    if (!comp || !comp.state) return;

    comp.state.display = this._createEmptyBuffer();
    this._display = comp.state.display;

    if (typeof draw === 'function') {
      draw();
    }
  }

  _validateExpectedI2C(comp) {
    if (!this._expectedI2C) {
      return { ok: true };
    }

    const expectedSda = this._expectedI2C.sdaPin;
    const expectedScl = this._expectedI2C.sclPin;

    if (expectedSda === null || expectedSda === undefined || expectedScl === null || expectedScl === undefined) {
      return {
        ok: false,
        summary: 'SSD1306: invalid I2C pin configuration in code'
      };
    }

    const missing = [];
    const sdaName = typeof mcuPinName === 'function' ? mcuPinName(expectedSda) : String(expectedSda);
    const sclName = typeof mcuPinName === 'function' ? mcuPinName(expectedScl) : String(expectedScl);

    if (!this._isPinConnectedToMcu(comp, 'SDA', expectedSda)) {
      missing.push('SDA -> ' + sdaName);
    }

    if (!this._isPinConnectedToMcu(comp, 'SCL', expectedScl)) {
      missing.push('SCL -> ' + sclName);
    }

    if (missing.length === 0) {
      return { ok: true };
    }

    return {
      ok: false,
      summary: 'SSD1306: OLED wiring does not match the I2C pins used in code',
      detail: 'Expected connections: ' + missing.join(', ')
    };
  }

  _isReady() {
    return !!(this._initialized && this._findComponent());
  }

  _findComponent() {
    if (typeof components === 'undefined') return null;

    if (this._component && components.includes(this._component)) {
      return this._component;
    }

    let wiredOLED = null;
    let anyOLED = null;

    for (const comp of components) {
      if (comp.type !== 'ssd1306') continue;

      if (!anyOLED) anyOLED = comp;
      if (this._hasRequiredConnections(comp)) {
        wiredOLED = comp;
        break;
      }
    }

    this._component = wiredOLED || anyOLED || null;

    if (this._component) {
      if (!this._component.state) this._component.state = {};
      if (!Array.isArray(this._component.state.display)) {
        this._component.state.display = this._createEmptyBuffer();
      }
      this._display = this._component.state.display;
    }

    return this._component;
  }

  begin(vccSource, addr) {
    const comp = this._findComponent();
    this._initialized = false;

    if (!comp) {
      if (typeof serialLog === 'function') {
        serialLog('⚠️ SSD1306: no OLED component on canvas');
      }
      return false;
    }

    if (typeof addr === 'number') {
      this._address = addr;
    }

    if (!this._hasRequiredConnections(comp)) {
      if (typeof serialLog === 'function') {
        serialLog('❌ SSD1306: OLED exists but is not fully wired');
        serialLog('Required: GND, VCC, SCL, SDA');
      }
      this._clearComponentDisplay(comp);
      return false;
    }

    const busCheck = this._validateExpectedI2C(comp);
    if (!busCheck.ok) {
      if (typeof serialLog === 'function') {
        serialLog(busCheck.summary);
        if (busCheck.detail) serialLog(busCheck.detail);
      }
      if (typeof showConnAlert === 'function') {
        showConnAlert(busCheck.detail || busCheck.summary);
      }
      this._clearComponentDisplay(comp);
      return false;
    }

    this._display = comp.state.display;
    this.clearDisplay();
    this._initialized = true;

    if (typeof serialLog === 'function') {
      serialLog(`✅ SSD1306 OLED initialized (${this._width}x${this._height}) @ 0x${this._address.toString(16).toUpperCase()}`);
    }

    return true;
  }

  _drawChar(ch, x, y, size) {
    const glyph = this._font[ch] || this._font[' '];

    for (let col = 0; col < 5; col++) {
      const line = glyph[col];

      for (let row = 0; row < 7; row++) {
        if (line & (1 << row)) {
          for (let sx = 0; sx < size; sx++) {
            for (let sy = 0; sy < size; sy++) {
              const px = x + col * size + sx;
              const py = y + row * size + sy;

              if (px >= 0 && px < 128 && py >= 0 && py < 64) {
                const page = Math.floor(py / 8);
                const bit = py % 8;

                if (this._textColor) {
                  this._display[page][px] |= (1 << bit);
                } else {
                  this._display[page][px] &= ~(1 << bit);
                }
              }
            }
          }
        }
      }
    }
  }

  print(str) {
    if (!this._isReady()) return;
    str = String(str == null ? '' : str).replace(/^"|"$/g, '');

    const charWidth = 6 * this._textSize;
    const charHeight = 8 * this._textSize;

    for (let i = 0; i < str.length; i++) {
      const ch = str[i];

      if (ch === '\n') {
        this._cursorX = 0;
        this._cursorY += charHeight;
        continue;
      }

      if (this._cursorX + charWidth > this._width) {
        this._cursorX = 0;
        this._cursorY += charHeight;
      }

      if (this._cursorY + charHeight > this._height) {
        this._cursorY = 0;
      }

      this._drawChar(ch, this._cursorX, this._cursorY, this._textSize);
      this._cursorX += charWidth;
    }
  }

  println(str) {
    if (!this._isReady()) return;
    const charHeight = 8 * this._textSize;
    this.print(str || '');
    this._cursorX = 0;
    this._cursorY += charHeight;

    if (this._cursorY >= this._height) {
      this._cursorY = 0;
    }
  }

  clearDisplay() {
    for (let p = 0; p < 8; p++) {
      for (let x = 0; x < 128; x++) {
        this._display[p][x] = 0;
      }
    }

    this._cursorX = 0;
    this._cursorY = 0;

    if (typeof serialLog === 'function') {
      serialLog('🖥️ OLED: Display cleared');
    }
  }

  display() {
    if (!this._isReady()) return;
    const comp = this._findComponent();
    if (!comp) return;

    comp.state.display = this._display.map(page => page.slice());

    if (typeof draw === 'function') {
      draw();
    }
  }

  setCursor(x, y) {
    this._cursorX = Math.min(Math.max(Number(x) || 0, 0), this._width - 1);
    this._cursorY = Math.min(Math.max(Number(y) || 0, 0), this._height - 1);
  }

  setTextSize(size) {
    this._textSize = Math.max(1, Math.min(Number(size) || 1, 3));
  }

  setTextColor(color) {
    this._textColor = color ? 1 : 0;
  }

  fillScreen(color) {
    if (!this._isReady()) return;
    const value = color ? 0xFF : 0x00;

    for (let p = 0; p < 8; p++) {
      for (let x = 0; x < 128; x++) {
        this._display[p][x] = value;
      }
    }

    this._cursorX = 0;
    this._cursorY = 0;
  }

  fill(color) {
    if (!this._isReady()) return;
    this.fillScreen(color);
  }

  text(str, x, y, color) {
    if (!this._isReady()) return;

    const prevX = this._cursorX;
    const prevY = this._cursorY;
    const prevColor = this._textColor;

    this.setCursor(x, y);
    this.setTextColor(color === undefined ? 1 : color);
    this.print(str || '');

    this._cursorX = prevX;
    this._cursorY = prevY;
    this._textColor = prevColor;
  }

  show() {
    this.display();
  }

  invertDisplay(invert) {
    if (typeof serialLog === 'function') {
      serialLog('OLED: Display ' + (invert ? 'inverted' : 'normal'));
    }
  }

  dim(dimmed) {
    if (typeof serialLog === 'function') {
      serialLog('OLED: Display ' + (dimmed ? 'dimmed' : 'bright'));
    }
  }

  getDisplay() {
    return this._display;
  }

  getWidth() {
    return this._width;
  }

  getHeight() {
    return this._height;
  }
}

if (typeof libraryRegistry !== 'undefined') {
  libraryRegistry.registerLibrary('Adafruit_SSD1306', SSD1306Library, {
    headerFile: 'Adafruit_SSD1306.h',
    constructorRegex: /Adafruit_SSD1306\s+(\w+)\s*\((.*)\)\s*;?$/
  });

  libraryRegistry.registerLibrary('SSD1306', SSD1306Library, {
    headerFile: 'SSD1306.h',
    constructorRegex: /SSD1306\s+(\w+)\s*\((.*)\)\s*;?$/
  });
}
