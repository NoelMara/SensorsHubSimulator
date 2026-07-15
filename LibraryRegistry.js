// LibraryRegistry.js

class LibraryRegistry {
  constructor() {
    this._libraries = {};
    this._instances = {};
    this._globalInstances = {};
  }

  registerLibrary(name, LibraryClass, config = {}) {
    this._libraries[name.toLowerCase()] = {
      name,
      LibraryClass,
      headerFile: config.headerFile || `${name}.h`,
      constructorRegex: config.constructorRegex ||
        new RegExp(`^${name}\\s+(\\w+)\\s*\\((.*)\\)\\s*;?$`)
    };
  }

  parseInclude(line) {
    const m = String(line || '').trim().match(/#include\s+[<"](.+)[>"]/);
    if (!m) return null;

    const header = m[1];
    for (const lib of Object.values(this._libraries)) {
      if (lib.headerFile === header) return lib;
    }
    return null;
  }

  tryInstantiate(line) {
    const trimmed = String(line || '').trim();

    for (const lib of Object.values(this._libraries)) {
      const match = trimmed.match(lib.constructorRegex);
      if (!match) continue;

      const varName = match[1];
      const argsStr = match.length > 2 ? (match[2] || '') : '';
      const args = this._parseArgs(argsStr);
      const instance = new lib.LibraryClass(...args);

      this._instances[varName] = instance;

      return {
        variableName: varName,
        instance,
        library: lib
      };
    }

    return null;
  }

  getInstance(varName) {
    return this._instances[varName] || null;
  }

  setInstance(varName, instance) {
    this._instances[varName] = instance;
    return instance;
  }

  setGlobalInstance(varName, instance) {
    this._globalInstances[varName] = instance;
    this._instances[varName] = instance;
    return instance;
  }

  parseMethodCall(line) {
    const trimmed = String(line || '').trim();
    const typePattern = '(?:unsigned\\s+long|float|int|long|byte|double|String|bool|char)';

    const assignRegex = new RegExp(
      `^(?:(?:${typePattern})\\s+)?(\\w+)\\s*=\\s*(\\w+)\\.(\\w+)\\((.*)\\)\\s*;?$`
    );

    const m = trimmed.match(assignRegex);
    if (m) {
      const resultVariable = m[1];
      const instanceName = m[2];
      const methodName = m[3];
      const argsStr = m[4] || '';
      const instance = this._instances[instanceName];

      if (instance) {
        return {
          instance,
          methodName,
          args: this._parseArgs(argsStr),
          resultVariable
        };
      }
    }

    const standaloneRegex = /^(\w+)\.(\w+)\((.*)\)\s*;?$/;
    const m2 = trimmed.match(standaloneRegex);
    if (m2) {
      const instanceName = m2[1];
      const methodName = m2[2];
      const argsStr = m2[3] || '';
      const instance = this._instances[instanceName];

      if (instance) {
        return {
          instance,
          methodName,
          args: this._parseArgs(argsStr),
          resultVariable: null
        };
      }
    }

    return null;
  }

  _splitArgs(str) {
    const source = String(str || '').trim();
    if (!source) return [];

    const parts = [];
    let current = '';
    let depth = 0;
    let inSingle = false;
    let inDouble = false;

    for (let i = 0; i < source.length; i++) {
      const ch = source[i];
      const prev = i > 0 ? source[i - 1] : '';

      if (ch === "'" && !inDouble && prev !== '\\') {
        inSingle = !inSingle;
        current += ch;
        continue;
      }

      if (ch === '"' && !inSingle && prev !== '\\') {
        inDouble = !inDouble;
        current += ch;
        continue;
      }

      if (!inSingle && !inDouble) {
        if (ch === '(' || ch === '[' || ch === '{') depth++;
        if (ch === ')' || ch === ']' || ch === '}') depth--;

        if (ch === ',' && depth === 0) {
          parts.push(current.trim());
          current = '';
          continue;
        }
      }

      current += ch;
    }

    if (current.trim()) parts.push(current.trim());
    return parts;
  }

  _parseArgs(str) {
    if (!str || !String(str).trim()) return [];

    return this._splitArgs(str).map(s => {
      s = s.trim();

      if (!s) return '';

      if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
        return s.slice(1, -1);
      }

      if (s.startsWith('&')) {
        const refName = s.slice(1).trim();
        return this.getInstance(refName) || refName;
      }

      if (/^0x[0-9a-f]+$/i.test(s)) {
        return parseInt(s, 16);
      }

      if (s === 'true') return true;
      if (s === 'false') return false;

      if (/^[A-Z_][A-Z0-9_]*$/.test(s) && !/^\d/.test(s)) {
        return s;
      }

      const n = Number(s);
      if (!Number.isNaN(n)) return n;

      return s;
    });
  }

  reset() {
    this._instances = { ...this._globalInstances };
  }
}

const libraryRegistry = new LibraryRegistry();
