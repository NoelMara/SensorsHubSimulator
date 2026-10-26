// ==========================================
// STARTER LESSONS - lessons.js
// ==========================================

var STARTER_LESSONS = {
  blink: {
    title: 'ESP32 LED Blink',
    fileMode: 'ino',
    ino: '#define LED_PIN 2\n\nvoid setup() {\n  pinMode(LED_PIN, OUTPUT);\n  Serial.begin(115200);\n}\n\nvoid loop() {\n  digitalWrite(LED_PIN, HIGH);\n  delay(500);\n  digitalWrite(LED_PIN, LOW);\n  delay(500);\n  Serial.println("Blink!");\n}',
    py: '',
    build: function() {
      var mcu = placeLessonComponent('esp32', 70, 36);
      var led = placeLessonComponent('led_red', 410, 220);
      connectLessonPins(led, '+', mcu, 'D2');
      connectLessonPins(led, '-', mcu, 'GND');
    }
  },
  dht: {
    title: 'ESP32 DHT22 Serial',
    fileMode: 'ino',
    ino: '#include <DHT.h>\n#define DHTPIN 4\n#define DHTTYPE DHT22\n\nDHT dht(DHTPIN, DHTTYPE);\n\nvoid setup() {\n  Serial.begin(115200);\n  dht.begin();\n}\n\nvoid loop() {\n  float t = dht.readTemperature();\n  float h = dht.readHumidity();\n  Serial.print("Temp: ");\n  Serial.println(t);\n  Serial.print("Hum: ");\n  Serial.println(h);\n  delay(1000);\n}',
    py: '',
    build: function() {
      var mcu = placeLessonComponent('esp32', 70, 36);
      var dht = placeLessonComponent('dht', 340, 170);
      connectLessonPins(dht, 'VCC', mcu, '3V3');
      connectLessonPins(dht, 'GND', mcu, 'GND');
      connectLessonPins(dht, 'Data', mcu, 'D4');
    }
  },
  ultrasonic: {
    title: 'ESP32 HC-SR04 Distance',
    fileMode: 'ino',
    ino: '#define TRIG_PIN 5\n#define ECHO_PIN 18\n\nvoid setup() {\n  pinMode(TRIG_PIN, OUTPUT);\n  pinMode(ECHO_PIN, INPUT);\n  Serial.begin(115200);\n}\n\nvoid loop() {\n  digitalWrite(TRIG_PIN, LOW);\n  delayMicroseconds(2);\n  digitalWrite(TRIG_PIN, HIGH);\n  delayMicroseconds(10);\n  digitalWrite(TRIG_PIN, LOW);\n  long duration = pulseIn(ECHO_PIN, HIGH);\n  float distance = duration * 0.034 / 2;\n  Serial.print("Distance: ");\n  Serial.println(distance);\n  delay(300);\n}',
    py: '',
    build: function() {
      var mcu = placeLessonComponent('esp32', 70, 36);
      var sensor = placeLessonComponent('ultrasonic', 360, 180);
      connectLessonPins(sensor, 'VCC', mcu, '3V3');
      connectLessonPins(sensor, 'GND', mcu, 'GND');
      connectLessonPins(sensor, 'Trig', mcu, 'D5');
      connectLessonPins(sensor, 'Echo', mcu, 'D18');
    }
  }
};

function findLessonPin(comp, pinName) {
  if (!comp || !comp.pins) return null;
  for (var i = 0; i < comp.pins.length; i++) {
    if (comp.pins[i].name === pinName) return comp.pins[i];
  }
  return null;
}

function placeLessonComponent(type, x, y) {
  var comp = null;
  if (type === 'esp32') comp = createESP32(x, y);
  else if (type === 'pico') comp = createPico(x, y);
  else if (type === 'led_red') comp = createLED(x, y, '#ff3344', 'Red');
  else if (type === 'dht') comp = createDHT22(x, y);
  else if (type === 'ultrasonic') comp = createUltrasonic(x, y);
  if (!comp) return null;
  components.push(comp);
  return comp;
}

function connectLessonPins(compA, pinAName, compB, pinBName) {
  var pinA = findLessonPin(compA, pinAName);
  var pinB = findLessonPin(compB, pinBName);
  if (!pinA || !pinB) return null;

  var pin1Id = compA.id + '_' + pinA.name;
  var pin2Id = compB.id + '_' + pinB.name;
  var color = '#7aa2f7';
  if (pinA.type === 'power' || pinB.type === 'power') color = '#f7768e';
  else if (pinA.type === 'gnd' || pinB.type === 'gnd') color = '#8b7355';
  else if (pinA.type === 'gpio' || pinB.type === 'gpio') color = '#9ece6a';

  var lane = typeof getAvailableWireLane === 'function' ? getAvailableWireLane() : 0;
  var waypoints = typeof buildWireWaypoints === 'function'
    ? buildWireWaypoints(pinA, pinB, [], 0, lane)
    : [{ x: pinA.x, y: pinA.y }, { x: pinB.x, y: pinB.y }];
  if (typeof simplifyWirePath === 'function') {
    waypoints = simplifyWirePath(waypoints);
  }

  var wire = {
    x1: pinA.x,
    y1: pinA.y,
    x2: pinB.x,
    y2: pinB.y,
    color: color,
    pin1Id: pin1Id,
    pin2Id: pin2Id,
    waypoints: waypoints,
    lane: lane,
    autoRoute: true
  };
  wires.push(wire);
  return wire;
}

function loadStarterLesson(id) {
  var lesson = STARTER_LESSONS[id];
  if (!lesson) {
    updateStatus('Unknown lesson');
    return false;
  }

  if (typeof running !== 'undefined' && running && typeof stopCode === 'function') {
    stopCode();
  }

  if (typeof saveState === 'function') saveState();
  components = [];
  wires = [];
  wireStart = null;

  if (typeof resizeCanvas === 'function') resizeCanvas();
  lesson.build();

  // Render once before routing because some component renderers (including
  // the LED) finalize their pin coordinates during draw().
  if (typeof draw === 'function') draw();

  if (typeof updateWireEndpointsFromPins === 'function') updateWireEndpointsFromPins();
  if (typeof rerouteAutomaticWires === 'function') rerouteAutomaticWires();
  if (typeof fixOffscreenComponents === 'function') fixOffscreenComponents();

  if (typeof _savedContent !== 'undefined') {
    _savedContent.ino = lesson.ino || '';
    _savedContent.py = lesson.py || '';
  }

  if (typeof applyLoadedMode === 'function') {
    applyLoadedMode(lesson.fileMode === 'py' ? 'py' : 'ino');
  } else if (typeof setEditorContent === 'function') {
    setEditorContent(lesson.ino || '');
  }

  if (typeof draw === 'function') draw();
  if (typeof scheduleRecoverySave === 'function') scheduleRecoverySave();
  updateStatus('Loaded: ' + lesson.title);
  if (typeof showConnectionToast === 'function') showConnectionToast('Loaded ' + lesson.title);
  return true;
}
