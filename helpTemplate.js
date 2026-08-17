window.HELP_MODAL_HTML = `
<!-- ============================================================
     HELP MODAL
     ============================================================ -->
<div id="help-overlay" class="help-overlay help-hidden" onclick="closeHelpOutside(event)">
  <div class="help-modal" role="dialog" aria-modal="true" aria-label="How to use SensorsHub">

    <div class="help-header">
      <div class="help-title-block">
        <div class="help-modal-logo">Sensors<span>:Hub</span></div>
        <div class="help-modal-sub">Quick Start Guide - University of Eastern Pangasinan</div>
      </div>
      <button class="help-close-btn" onclick="closeHelp()" title="Close">&times;</button>
    </div>

    <div class="help-tabs" role="tablist">
      <button class="help-tab active" role="tab" onclick="switchHelpTab('beta',this)">&#129514; Beta</button>
      <button class="help-tab" role="tab" onclick="switchHelpTab('basics',this)">&#128640; Basics</button>
      <button class="help-tab" role="tab" onclick="switchHelpTab('wiring',this)">&#12336; Wiring</button>
      <button class="help-tab" role="tab" onclick="switchHelpTab('code',this)">{ } Code</button>
      <button class="help-tab" role="tab" onclick="switchHelpTab('components',this)">&#128230; Components</button>
      <button class="help-tab" role="tab" onclick="switchHelpTab('shortcuts',this)">&#9000; Shortcuts</button>
      <button class="help-tab" role="tab" onclick="switchHelpTab('rules',this)">&#128203; Rules</button>
    </div>

    <div class="help-body">

      <div class="help-pane" id="help-pane-basics">
        <p class="help-intro">Welcome to <strong>SensorsHub</strong> - a browser-based simulator for beginner ESP32 and Pico projects. Build one circuit at a time, wire the parts, choose the matching code mode, then run your project on the canvas.</p>

        <div class="help-step">
          <div class="help-step-badge">1</div>
          <div class="help-step-content">
            <div class="help-step-title">Start with the correct microcontroller</div>
            <div class="help-step-desc">Open the <em>Build Kit</em> panel, choose <strong>&#128421; Microcontrollers</strong>, then place <strong>ESP32</strong> or <strong>Pico</strong> on the canvas. Only <strong>one microcontroller</strong> can be active at a time. Use <strong>ESP32</strong> for Arduino mode and <strong>Pico</strong> for MicroPython mode.</div>
          </div>
        </div>

        <div class="help-step">
          <div class="help-step-badge">2</div>
          <div class="help-step-content">
            <div class="help-step-title">Add sensors, lights, and peripherals</div>
            <div class="help-step-desc">Browse <strong>&#128161; Lights</strong>, <strong>&#128225; Sensors</strong>, and <strong>&#128295; Peripherals</strong> in the Build Kit. Place the parts near the board, then wire every required pin so the simulator can read or control them correctly.</div>
          </div>
        </div>

        <div class="help-step">
          <div class="help-step-badge">3</div>
          <div class="help-step-content">
            <div class="help-step-title">Wire every required pin</div>
            <div class="help-step-desc">Select the <strong>&#12336; Wire</strong> tool, click the first pin, then click the second pin. Most modules need power, ground, and a signal pin. Missing required wires can keep a part inactive or marked as <strong>NOT WIRED</strong>.</div>
          </div>
        </div>

        <div class="help-step">
          <div class="help-step-badge">4</div>
          <div class="help-step-content">
            <div class="help-step-title">Write code in the matching mode</div>
            <div class="help-step-desc">Use the <strong>{ } Editor</strong> panel to edit the default sketch or write your own. Switch between <strong>Arduino (.ino)</strong> and <strong>MicroPython (.py)</strong> at the top of the editor. Each mode keeps its own saved code.</div>
          </div>
        </div>

        <div class="help-step">
          <div class="help-step-badge">5</div>
          <div class="help-step-content">
            <div class="help-step-title">Run the simulation and monitor output</div>
            <div class="help-step-desc">Press <strong>&#9654; Run</strong> to start the simulation. Open <strong>&#9000; Serial</strong> to view <code>Serial.println()</code> or <code>print()</code> output, and press <strong>&#9632; Stop</strong> before changing wiring or restarting. If the board and code mode do not match, SensorsHub blocks the run and shows a warning.</div>
          </div>
        </div>

        <div class="help-tip">
          &#128161; <strong>Quick tip:</strong> To test the default blink sketch, place an <strong>ESP32</strong>, wire an LED <strong>+</strong> pin to <code>D2</code>, connect the LED <strong>-</strong> pin to <code>GND</code>, then press <strong>&#9654; Run</strong>.
        </div>
      </div>

      <div class="help-pane" id="help-pane-wiring">
        <p class="help-intro">Wires store exact pin-to-pin connections. SensorsHub checks each component's required pins before that part can respond reliably in the simulation.</p>

        <div class="help-step">
          <div class="help-step-badge">&#12336;</div>
          <div class="help-step-content">
            <div class="help-step-title">Draw a wire - Wire tool</div>
            <div class="help-step-desc">Click <strong>&#12336; Wire</strong> or press <kbd>W</kbd>. Click a pin to start a wire, then click another pin to finish the connection.</div>
          </div>
        </div>

        <div class="help-step">
          <div class="help-step-badge">&#10021;</div>
          <div class="help-step-content">
            <div class="help-step-title">Move components - Move tool</div>
            <div class="help-step-desc">Click <strong>&#10021; Move</strong> or press <kbd>M</kbd>, then drag a component to reposition it. Connected wires follow the part automatically.</div>
          </div>
        </div>

        <div class="help-step">
          <div class="help-step-badge">&#8617;</div>
          <div class="help-step-content">
            <div class="help-step-title">Bend wires around components</div>
            <div class="help-step-desc">Drag a wire midpoint to add a bend and keep your layout readable. <strong>Double-click</strong> a bend point to remove it.</div>
          </div>
        </div>

        <div class="help-step">
          <div class="help-step-badge">&#10005;</div>
          <div class="help-step-content">
            <div class="help-step-title">Delete wires or components</div>
            <div class="help-step-desc">Click the red <strong>&#10005; Delete</strong> button or press <kbd>D</kbd>, then click a wire or component to remove it. Press <kbd>Ctrl+Z</kbd> if you want to undo the last change.</div>
          </div>
        </div>

        <div class="help-step">
          <div class="help-step-badge">&#128465;</div>
          <div class="help-step-content">
            <div class="help-step-title">Clear the entire canvas</div>
            <div class="help-step-desc">Click <strong>&#128465; Clear</strong> to remove every component and wire from the canvas.</div>
          </div>
        </div>

        <div class="help-tip">
          &#128161; <strong>Pin tooltip:</strong> Hover near a pin with the Wire tool active to view its details. If a component is missing one of its required wires, a warning banner appears at the top of the canvas.
        </div>
      </div>

      <div class="help-pane" id="help-pane-code">
        <p class="help-intro">The editor supports Arduino C++ and MicroPython. Each language mode is paired with one board type so beginner projects stay predictable.</p>

        <div class="help-step">
          <div class="help-step-badge">&#8644;</div>
          <div class="help-step-content">
            <div class="help-step-title">Switch between Arduino and MicroPython</div>
            <div class="help-step-desc">Use the editor toggle to switch languages. <strong>Arduino (.ino)</strong> runs with <strong>ESP32</strong>; <strong>MicroPython (.py)</strong> runs with <strong>Pico</strong>. Both modes save separately.</div>
          </div>
        </div>

        <div class="help-step">
          <div class="help-step-badge">&#9654;</div>
          <div class="help-step-content">
            <div class="help-step-title">Run and stop your sketch</div>
            <div class="help-step-desc">Press <strong>&#9654; Run</strong> in the toolbar or inside the editor panel. Press <strong>&#9632; Stop</strong> to halt. If the placed board and selected code mode do not match, the simulator warns you instead of starting.</div>
          </div>
        </div>

        <div class="help-step">
          <div class="help-step-badge">&#9000;</div>
          <div class="help-step-content">
            <div class="help-step-title">Serial monitor</div>
            <div class="help-step-desc">Click <strong>&#9000; Serial</strong> in the toolbar. Output from <code>Serial.println()</code> in Arduino or <code>print()</code> in MicroPython appears here. You can also type text into the input box and press <strong>SEND</strong> to feed data into the running sketch. Arduino serial input supports common beginner patterns such as <code>char c = Serial.read()</code>, <code>c == 'A'</code>, <code>(char)Serial.read()</code>, and building text with <code>String +=</code>.</div>
          </div>
        </div>

        <div class="help-step">
          <div class="help-step-badge">{ }</div>
          <div class="help-step-content">
            <div class="help-step-title">Toggle the editor panel</div>
            <div class="help-step-desc">Click <strong>{ } Editor</strong> in the toolbar to collapse the code panel and free more canvas space. Click it again to bring the editor back. On mobile, use the bottom tab bar to switch between Studio and Code.</div>
          </div>
        </div>

        <div class="help-tip">
          &#128161; <strong>Libraries supported:</strong> This simulator includes built-in support for <code>DHT</code>, <code>Wire</code>, <code>Adafruit_SSD1306</code>, and <code>Servo</code>. Include them in Arduino mode just like normal sketches. Simple casts such as <code>(char)</code> and <code>(int)</code> are supported for serial-command examples.
        </div>
      </div>

      <div class="help-pane" id="help-pane-components">
        <p class="help-intro">Each Build Kit component has simulator-specific pins, readings, and interactions. Use this list as the expected behavior inside SensorsHub.</p>

        <div class="help-comp-section-title">Microcontrollers</div>
        <div class="help-comp-grid">
          <div class="help-comp-card">
            <div class="help-comp-top"><span class="help-comp-icon">&#128187;</span><strong>ESP32</strong></div>
            <span>Main board for <code>Arduino (.ino)</code> mode. Use digital pins such as <code>D2</code>, <code>D4</code>, <code>D5</code>, <code>D21</code>, <code>D22</code>, and <code>D23</code>. Analog input is available on <code>D32</code> to <code>D35</code>.</span>
          </div>
          <div class="help-comp-card">
            <div class="help-comp-top"><span class="help-comp-icon">&#129744;</span><strong>Raspberry Pi Pico</strong></div>
            <span>Main board for <code>MicroPython (.py)</code> mode. Use <code>GP</code> pins such as <code>GP0</code>, <code>GP1</code>, and <code>GP2</code>. Analog input is available on <code>GP26</code>, <code>GP27</code>, and <code>GP28</code>.</span>
          </div>
        </div>

        <div class="help-comp-section-title">Lights</div>
        <div class="help-comp-grid">
          <div class="help-comp-card">
            <div class="help-comp-top"><span class="help-comp-icon">&#128308;</span><strong>Red LED</strong></div>
            <span>Required pins: <code>+</code> and <code>-</code>. Connect <code>+</code> to a GPIO pin and <code>-</code> to <code>GND</code>. Use <code>digitalWrite(pin, HIGH)</code> to turn it on and <code>LOW</code> to turn it off.</span>
          </div>
          <div class="help-comp-card">
            <div class="help-comp-top"><span class="help-comp-icon">&#128994;</span><strong>Green LED</strong></div>
            <span>Required pins: <code>+</code> and <code>-</code>. Wire it like the red LED. Useful for ready, success, or safe-status indicators.</span>
          </div>
          <div class="help-comp-card">
            <div class="help-comp-top"><span class="help-comp-icon">&#128309;</span><strong>Blue LED</strong></div>
            <span>Required pins: <code>+</code> and <code>-</code>. Wire it like the other LEDs. Useful for signal, connection, or mode indicators.</span>
          </div>
          <div class="help-comp-card">
            <div class="help-comp-top"><span class="help-comp-icon">&#128993;</span><strong>Yellow LED</strong></div>
            <span>Required pins: <code>+</code> and <code>-</code>. Wire it like the other LEDs. Useful for warning, waiting, or transition states.</span>
          </div>
        </div>

        <div class="help-comp-section-title">Sensors</div>
        <div class="help-comp-grid">
          <div class="help-comp-card">
            <div class="help-comp-top"><span class="help-comp-icon">&#128225;</span><strong>HC-SR04 Ultrasonic</strong></div>
            <span>Required pins: <code>VCC</code>, <code>Trig</code>, <code>Echo</code>, <code>GND</code>. Trigger the sensor, then read the echo time with <code>pulseIn()</code>. The distance slider simulates objects from <code>2</code> to <code>400 cm</code>.</span>
          </div>
          <div class="help-comp-card">
            <div class="help-comp-top"><span class="help-comp-icon">&#127777;</span><strong>DHT22 Temp &amp; Humidity</strong></div>
            <span>Required simulator pins: <code>VCC</code>, <code>Data</code>, <code>GND</code>. The drawing labels them as <code>+</code>, <code>OUT</code>, and <code>-</code> to match common breakout modules. Arduino supports <code>dht.readTemperature()</code> and <code>dht.readHumidity()</code>. MicroPython supports <code>measure()</code>, <code>temperature()</code>, and <code>humidity()</code> when the DHT Data wire matches the code pin. Use the canvas sliders to change temperature and humidity.</span>
          </div>
          <div class="help-comp-card">
            <div class="help-comp-top"><span class="help-comp-icon">&#128680;</span><strong>HC-SR501 PIR Motion Sensor</strong></div>
            <span>Required pins: <code>GND</code>, <code>OUT</code>, <code>VCC</code>. In SensorsHub, <code>OUT</code> reads <code>HIGH</code> when motion is detected and <code>LOW</code> when idle. Click the sensor dome to toggle motion.</span>
          </div>
          <div class="help-comp-card">
            <div class="help-comp-top"><span class="help-comp-icon">&#127774;</span><strong>LDR Light Sensor</strong></div>
            <span>Required pins: <code>S</code>, <code>VCC</code>, <code>GND</code>. Read <code>S</code> with <code>analogRead()</code>. Higher values mean brighter light. Use the slider to change the simulated light level.</span>
          </div>
          <div class="help-comp-card">
            <div class="help-comp-top"><span class="help-comp-icon">&#128280;</span><strong>Button</strong></div>
            <span>Required pins: <code>P1</code> and <code>P2</code>. In SensorsHub, <code>digitalRead()</code> returns <code>LOW</code> while pressed and <code>HIGH</code> when released. Hold the canvas button to keep it pressed.</span>
          </div>
          <div class="help-comp-card">
            <div class="help-comp-top"><span class="help-comp-icon">&#128433;</span><strong>Joystick (KY-023)</strong></div>
            <span>Required pins: <code>VCC</code>, <code>GND</code>, <code>VRX</code>, <code>VRY</code>, <code>SW</code>. Read <code>VRX</code> and <code>VRY</code> with <code>analogRead()</code> for values from <code>0</code> to <code>4095</code>. Click the joystick cap to toggle <code>SW</code>; pressed reads <code>LOW</code>.</span>
          </div>
          <div class="help-comp-card">
            <div class="help-comp-top"><span class="help-comp-icon">&#127897;</span><strong>KY-004 Key Switch</strong></div>
            <span>Required pins: <code>S</code>, <code>VCC</code>, <code>GND</code>. In SensorsHub, <code>S</code> reads <code>LOW</code> when pressed and <code>HIGH</code> when released. Click the cap to toggle it.</span>
          </div>
          <div class="help-comp-card">
            <div class="help-comp-top"><span class="help-comp-icon">&#128243;</span><strong>SW-420 Vibration Sensor</strong></div>
            <span>Required pins: <code>DO</code>, <code>GND</code>, <code>VCC</code>. In SensorsHub, <code>DO</code> reads <code>HIGH</code> when vibration is detected and <code>LOW</code> when stable. Click the sensor body to toggle vibration.</span>
          </div>
          <div class="help-comp-card">
            <div class="help-comp-top"><span class="help-comp-icon">&#128293;</span><strong>Flame Sensor</strong></div>
            <span>Required pins: <code>AO</code>, <code>DO</code>, <code>GND</code>, <code>VCC</code>. In SensorsHub, <code>DO</code> reads <code>LOW</code> when flame is detected. Read <code>AO</code> with <code>analogRead()</code> for intensity. Click the sensor or use the slider to change flame level.</span>
          </div>
          <div class="help-comp-card">
            <div class="help-comp-top"><span class="help-comp-icon">&#128680;</span><strong>KY-032 IR Obstacle</strong></div>
            <span>Required pins: <code>OUT</code>, <code>VCC</code>, <code>GND</code>. The canvas also shows <code>EN</code>, but the simulator checks <code>OUT</code>, power, and ground. <code>OUT</code> reads <code>LOW</code> when an obstacle is detected and <code>HIGH</code> when clear. Click the sensor to toggle obstacle detection.</span>
          </div>
        </div>

        <div class="help-comp-section-title">Peripherals</div>
        <div class="help-comp-grid">
          <div class="help-comp-card">
            <div class="help-comp-top"><span class="help-comp-icon">&#9881;</span><strong>Servo Motor</strong></div>
            <span>Required pins: <code>PWM</code>, <code>VCC</code>, <code>GND</code>. In Arduino mode, control it with <code>Servo</code> and <code>servo.write(angle)</code> from <code>0</code> to <code>180</code>. PWM duty in MicroPython maps to the displayed angle. The canvas horn rotates live.</span>
          </div>
          <div class="help-comp-card">
            <div class="help-comp-top"><span class="help-comp-icon">&#128276;</span><strong>Buzzer</strong></div>
            <span>Required pins: <code>+</code> and <code>-</code>. Use <code>tone(pin, frequency)</code> to play, <code>noTone(pin)</code> to stop, or <code>digitalWrite(pin, HIGH)</code> for a simple on/off beep. The canvas icon changes while active.</span>
          </div>
          <div class="help-comp-card">
            <div class="help-comp-top"><span class="help-comp-icon">&#128223;</span><strong>OLED Display (SSD1306)</strong></div>
            <span>Required pins: <code>GND</code>, <code>VCC</code>, <code>SCL</code>, <code>SDA</code>. Use <code>Wire</code> and <code>Adafruit_SSD1306</code> in Arduino mode. On ESP32, the common simulator wiring is <code>SCL</code> to <code>D22</code> and <code>SDA</code> to <code>D21</code>. The display updates as your sketch runs.</span>
          </div>
        </div>

        <div class="help-tip">
          &#128161; <strong>Simulator tip:</strong> The output logic shown above describes SensorsHub behavior. Real modules can vary by manufacturer, so check your datasheet or test the physical module before assuming <code>HIGH</code> or <code>LOW</code>.
        </div>
      </div>

      <div class="help-pane" id="help-pane-shortcuts">
        <p class="help-intro">Use these shortcuts and gestures to work faster on desktop and mobile.</p>

        <div class="help-shortcut-section">Desktop</div>
        <div class="help-shortcut-table">
          <div class="help-shortcut-row"><div class="help-shortcut-keys"><kbd>W</kbd></div><div class="help-shortcut-label">Activate Wire tool</div></div>
          <div class="help-shortcut-row"><div class="help-shortcut-keys"><kbd>M</kbd></div><div class="help-shortcut-label">Activate Move tool</div></div>
          <div class="help-shortcut-row"><div class="help-shortcut-keys"><kbd>D</kbd></div><div class="help-shortcut-label">Activate Delete tool</div></div>
          <div class="help-shortcut-row"><div class="help-shortcut-keys"><kbd>Ctrl</kbd> + <kbd>Z</kbd></div><div class="help-shortcut-label">Undo last action</div></div>
          <div class="help-shortcut-row"><div class="help-shortcut-keys"><kbd>Esc</kbd></div><div class="help-shortcut-label">Cancel the current wire or close the help modal</div></div>
          <div class="help-shortcut-row"><div class="help-shortcut-keys"><kbd>Scroll</kbd></div><div class="help-shortcut-label">Zoom in / out on the canvas</div></div>
          <div class="help-shortcut-row"><div class="help-shortcut-keys">Hover near pin</div><div class="help-shortcut-label">Show pin tooltip with name, type, and connection status</div></div>
          <div class="help-shortcut-row"><div class="help-shortcut-keys">Drag midpoint</div><div class="help-shortcut-label">Bend a wire segment</div></div>
          <div class="help-shortcut-row"><div class="help-shortcut-keys">Double-click bend</div><div class="help-shortcut-label">Remove a bend point and straighten the wire</div></div>
        </div>

        <div class="help-shortcut-section">Mobile</div>
        <div class="help-shortcut-table">
          <div class="help-shortcut-row"><div class="help-shortcut-keys">&#128204; Studio tab</div><div class="help-shortcut-label">Switch to canvas view - tap the Build Kit panel to add components</div></div>
          <div class="help-shortcut-row"><div class="help-shortcut-keys">{ } Code tab</div><div class="help-shortcut-label">Switch to code editor view</div></div>
          <div class="help-shortcut-row"><div class="help-shortcut-keys">Pinch gesture</div><div class="help-shortcut-label">Zoom in / out on the canvas</div></div>
          <div class="help-shortcut-row"><div class="help-shortcut-keys">Tap a pin</div><div class="help-shortcut-label">Show pin tooltip details</div></div>
          <div class="help-shortcut-row"><div class="help-shortcut-keys">Drag midpoint</div><div class="help-shortcut-label">Bend a wire segment</div></div>
        </div>

        <div class="help-tip">
          &#128161; <strong>Tip:</strong> Press <kbd>Esc</kbd> any time to cancel a wire you started drawing or to close this help modal.
        </div>
      </div>

      <div class="help-pane" id="help-pane-rules">
        <p class="help-intro">SensorsHub is a learning simulator, not a full replacement for real ESP32 or Pico hardware. Follow these rules to get the most reliable results.</p>

        <div class="help-step">
          <div class="help-step-badge">1</div>
          <div class="help-step-content">
            <div class="help-step-title">Match the board to the code mode</div>
            <div class="help-step-desc">Use <strong>ESP32</strong> with <strong>Arduino (.ino)</strong> mode. Use <strong>Pico</strong> with <strong>MicroPython (.py)</strong> mode. If the board and language do not match, the simulator will not run and a warning will appear.</div>
          </div>
        </div>

        <div class="help-step">
          <div class="help-step-badge">2</div>
          <div class="help-step-content">
            <div class="help-step-title">Wire every required pin</div>
            <div class="help-step-desc">Do not connect only the signal pin. Most parts also need <strong>VCC</strong> and <strong>GND</strong>. If one required wire is missing, the component shows a <strong>&#9888; NOT WIRED</strong> warning on the canvas and may stay inactive or always read <code>0</code>.</div>
          </div>
        </div>

        <div class="help-step">
          <div class="help-step-badge">3</div>
          <div class="help-step-content">
            <div class="help-step-title">Verify your module's output logic</div>
            <div class="help-step-desc">Each component card in the <strong>&#128230; Components</strong> tab shows how that part behaves inside this simulator. Real modules may differ depending on the manufacturer, so always test your physical hardware separately.</div>
          </div>
        </div>

        <div class="help-step">
          <div class="help-step-badge">4</div>
          <div class="help-step-content">
            <div class="help-step-title">Test one component at a time first</div>
            <div class="help-step-desc">Before building a bigger project, confirm that each LED, button, sensor, or motor works by itself. This makes wiring mistakes and pin mismatches much easier to find and fix.</div>
          </div>
        </div>

        <div class="help-step">
          <div class="help-step-badge">5</div>
          <div class="help-step-content">
            <div class="help-step-title">Keep MicroPython code simple</div>
            <div class="help-step-desc">For the best results, write simple MicroPython using one main <code>while True:</code> loop, one statement per line, and basic <code>if / elif / else</code> logic. Basic <code>try/except</code> is supported for simulator/runtime errors, including inside simple <code>if</code> blocks. Avoid advanced features such as classes and complex helper functions unless you have tested them in this simulator.</div>
          </div>
        </div>

        <div class="help-step">
          <div class="help-step-badge">6</div>
          <div class="help-step-content">
            <div class="help-step-title">Use simulator-supported commands</div>
            <div class="help-step-desc">MicroPython support covers: <code>Pin</code>, <code>value()</code>, <code>ADC.read_u16()</code>, <code>PWM.freq()</code>, <code>PWM.duty_u16()</code>, <code>time.sleep()</code>, <code>time.sleep_ms()</code>, <code>time.sleep_us()</code>, <code>print()</code>, <code>time_pulse_us()</code>, and simple <code>try/except</code>. Arduino support follows built-in simulator functions, common serial input patterns, simple casts, and the included libraries.</div>
          </div>
        </div>

        <div class="help-step">
          <div class="help-step-badge">7</div>
          <div class="help-step-content">
            <div class="help-step-title">Interact with the parts on the canvas</div>
            <div class="help-step-desc">Some components have sliders or clickable areas on the canvas that let you simulate input during a running sketch. Check each component card in the <strong>&#128230; Components</strong> tab to see how to interact with it.</div>
          </div>
        </div>

        <div class="help-step">
          <div class="help-step-badge">8</div>
          <div class="help-step-content">
            <div class="help-step-title">Run again after code or wiring changes</div>
            <div class="help-step-desc">If you edit code, move wires, or replace parts, press <strong>Stop</strong> and then <strong>Run</strong> again so the simulator reloads the current circuit and program state cleanly.</div>
          </div>
        </div>

        <div class="help-tip">
          &#128161; <strong>Quick reminder:</strong> If a reading always stays at <code>0</code>, first check the board mode, then check the exact pin numbers, then confirm that every required wire for that component is connected. If readings seem inverted, your physical module may use different output logic than SensorsHub - check the datasheet for your specific module.
        </div>
      </div>


      <div class="help-pane active" id="help-pane-beta">
        <p class="help-intro"><strong>Beta notice:</strong> SensorsHub is still a prototype for learning and classroom practice. It is useful for testing beginner circuits and code, but it may not match real hardware perfectly in every situation.</p>

        <div class="help-step">
          <div class="help-step-badge">B1</div>
          <div class="help-step-content">
            <div class="help-step-title">Built for beginner project patterns</div>
            <div class="help-step-desc">SensorsHub focuses on common Arduino and MicroPython lessons: LEDs, buttons, sensors, serial input, simple conditions, loops, and basic component control. Advanced C++ syntax, complex Python structures, custom classes, and unusual library behavior may not be fully simulated yet.</div>
          </div>
        </div>

        <div class="help-step">
          <div class="help-step-badge">B2</div>
          <div class="help-step-content">
            <div class="help-step-title">Some features are still being improved</div>
            <div class="help-step-desc">Serial input, MicroPython conversion, sensor timing, and library behavior are being improved as more student examples are tested. If a simple sketch behaves differently from real hardware, it may be a simulator limitation rather than a mistake in your code.</div>
          </div>
        </div>

        <div class="help-step">
          <div class="help-step-badge">B3</div>
          <div class="help-step-content">
            <div class="help-step-title">Wiring warnings are learning guides</div>
            <div class="help-step-desc">If a matching component is placed but miswired, SensorsHub tries to show a helpful warning. If no matching component is placed at all, writing to that pin may stay silent, similar to real hardware where the board cannot know what is connected externally.</div>
          </div>
        </div>

        <div class="help-step">
          <div class="help-step-badge">B4</div>
          <div class="help-step-content">
            <div class="help-step-title">Always final-check on real hardware</div>
            <div class="help-step-desc">Use SensorsHub to learn, debug wiring logic, and test beginner code quickly. Before submitting, presenting, or building a final project, test again on the actual ESP32 or Pico with your real modules.</div>
          </div>
        </div>

        <div class="help-tip">
          &#128161; <strong>Helpful feedback:</strong> If a beginner project works on real hardware but not in SensorsHub, note the component, wiring, and exact code pattern. Those reports help make the simulator better.
        </div>
      </div>

    </div>

    <div class="help-footer">
      <div class="help-footer-left">
        <span class="help-footer-brand">SensorsHub</span>
        <span class="help-footer-uni">University of Eastern Pangasinan</span>
      </div>
      <button class="btn green help-footer-btn" onclick="closeHelp()">Got it &#10003;</button>
    </div>

  </div>
</div>
`;
