// libraries/Wire.js

class WireLibrary {
  constructor() {
    this.sda = 21;
    this.scl = 22;
    this.started = false;
  }

  begin(sda, scl) {
    this.sda = (typeof sda === 'number') ? sda : 21;
    this.scl = (typeof scl === 'number') ? scl : 22;
    this.started = true;

    if (typeof serialLog === 'function') {
      serialLog(`📡 Wire.begin(${this.sda}, ${this.scl})`);
    }

    return true;
  }
}

if (typeof libraryRegistry !== 'undefined') {
  libraryRegistry.registerLibrary('Wire', WireLibrary, {
    headerFile: 'Wire.h'
  });

  if (typeof libraryRegistry.setGlobalInstance === 'function') {
    libraryRegistry.setGlobalInstance('Wire', new WireLibrary());
  } else {
    libraryRegistry._instances['Wire'] = new WireLibrary();
  }
}
