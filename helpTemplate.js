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
      <button class="help-tab active" role="tab" onclick="switchHelpTab('basics',this)">&#128640; Basics</button>
      <button class="help-tab" role="tab" onclick="switchHelpTab('wiring',this)">&#12336; Wiring</button>
      <button class="help-tab" role="tab" onclick="switchHelpTab('code',this)">{ } Code</button>
      <button class="help-tab" role="tab" onclick="switchHelpTab('components',this)">&#128230; Components</button>
      <button class="help-tab" role="tab" onclick="switchHelpTab('shortcuts',this)">&#9000; Shortcuts</button>
      <button class="help-tab" role="tab" onclick="switchHelpTab('rules',this)">&#128203; Rules</button>
    </div>

    <div class="help-body">

      <div class="help-pane active" id="help-pane-basics">
        <p class="help-intro">Welcome to <strong>SensorsHub</strong> - a browser-based microcontroller simulator for one-board-at-a-time projects. Follow these steps to build and run your circuit the way this simulator expects.</p>

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
            <div class="help-step-desc">Browse the <strong>&#128161; Lights</strong>, <strong>&#128225; Sensors</strong>, and <strong>&#128295; Peripherals</strong> tabs in the Build Kit. Place the parts you need near the board. Every component must be <strong>fully wired</strong> before it will react correctly in the simulation.</div>
          </div>
        </div>

        <div class="help-step">
          <div class="help-step-badge">3</div>
          <div class="help-step-content">
            <div class="help-step-title">Wire every required pin</div>
            <div class="help-step-desc">Make sure the <strong>&#12336; Wire</strong> tool is selected in the toolbar. Click a pin on one component, then click a pin on another to connect them. If a component is missing required pins such as <strong>VCC</strong>, <strong>GND</strong>, or its signal line, the simulator shows a warning and the part may stay marked as not wired.</div>
          </div>
        </div>

        <div class="help-step">
          <div class="help-step-badge">4</div>
          <div class="help-step-content">
            <div class="help-step-title">Write code in the matching mode</div>
            <div class="help-step-desc">The <strong>{ } Editor</strong> panel is on the left. Edit the default sketch or write your own. Toggle between <strong>Arduino (.ino)</strong> and <strong>MicroPython (.py)</strong> at the top of the editor. Each mode keeps its own saved code.</div>
          </div>
        </div>

        <div class="help-step">
          <div class="help-step-badge">5</div>
          <div class="help-step-content">
            <div class="help-step-title">Run the simulation and monitor output</div>
            <div class="help-step-desc">Press the green <strong>&#9654; Run</strong> button in the toolbar. Open <strong>&#9000; Serial</strong> to view <code>Serial.println()</code> or <code>print()</code> output. Press <strong>&#9632; Stop</strong> to end the simulation. If the board and code mode do not match, running is blocked and a warning appears.</div>
          </div>
        </div>

        <div class="help-tip">
          &#128161; <strong>Quick tip:</strong> To test the default blink sketch, place an <strong>ESP32</strong>, wire an LED <strong>+</strong> pin to <code>D2</code>, connect the LED <strong>-</strong> pin to <code>GND</code>, then press <strong>&#9654; Run</strong>.
        </div>
      </div>

      <div class="help-pane" id="help-pane-wiring">
        <p class="help-intro">All connections between components are made with wires, and the simulator checks exact required pins before a component becomes active.</p>

        <div class="help-step">
          <div class="help-step-badge">&#12336;</div>
          <div class="help-step-content">
            <div class="help-step-title">Draw a wire - Wire tool</div>
            <div class="help-step-desc">Click the <strong>&#12336; Wire</strong> button in the toolbar or press <kbd>W</kbd>. Click a pin on any component to start a wire, then click a second pin to finish it. The simulator stores that exact pin-to-pin connection.</div>
          </div>
        </div>

        <div class="help-step">
          <div class="help-step-badge">&#10021;</div>
          <div class="help-step-content">
            <div class="help-step-title">Move components - Move tool</div>
            <div class="help-step-desc">Click the <strong>&#10021; Move</strong> button or press <kbd>M</kbd>. Drag any component to reposition it. Connected wires stretch and follow the component automatically.</div>
          </div>
        </div>

        <div class="help-step">
          <div class="help-step-badge">&#8617;</div>
          <div class="help-step-content">
            <div class="help-step-title">Bend wires around components</div>
            <div class="help-step-desc">After drawing a wire, drag its midpoint handle to create a bend. This helps keep your layout readable. <strong>Double-click</strong> a bend point to remove it and straighten the segment again.</div>
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
            <div class="help-step-desc">Click <strong>&#128465; Clear</strong> to remove all components and wires at once and start over. Use this when you want a full reset.</div>
          </div>
        </div>

        <div class="help-tip">
          &#128161; <strong>Pin tooltip:</strong> Hover near a pin with the Wire tool active to view its details. If a component is missing one of its required wires, a warning banner appears at the top of the canvas.
        </div>
      </div>

      <div class="help-pane" id="help-pane-code">
        <p class="help-intro">The code editor supports both Arduino C++ and MicroPython, but each language mode has a matching board in this simulator.</p>

        <div class="help-step">
          <div class="help-step-badge">&#8644;</div>
          <div class="help-step-content">
            <div class="help-step-title">Switch between Arduino and MicroPython</div>
            <div class="help-step-desc">Use the toggle at the top of the editor. <strong>Arduino (.ino)</strong> mode works with <strong>ESP32</strong>. <strong>MicroPython (.py)</strong> mode works with <strong>Pico</strong>. Both modes save independently.</div>
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
            <div class="help-step-desc">Click <strong>&#9000; Serial</strong> in the toolbar. Output from <code>Serial.println()</code> in Arduino or <code>print()</code> in MicroPython appears here. You can also type text into the input box and press <strong>SEND</strong> to feed data into the running sketch.</div>
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
          &#128161; <strong>Libraries supported:</strong> This simulator includes built-in support for <code>DHT</code>, <code>Wire</code>, <code>Adafruit_SSD1306</code>, and <code>Servo</code>. Include them in Arduino mode just like normal sketches.
        </div>
      </div>

      <div class="help-pane" id="help-pane-components">
        <p class="help-intro">Every component in the Build Kit has required simulator pins. Wire them correctly or the part will not respond as expected.</p>

        <div class="help-comp-section-title">Microcontrollers</div>
        <div class="help-comp-grid">
          <div class="help-comp-card">
            <div class="help-comp-top"><span class="help-comp-icon">&#128187;</span><strong>ESP32</strong></div>
            <span>Main board for <code>Arduino (.ino)</code> mode. Use its D pins such as <code>D2</code>, <code>D4</code>, <code>D5</code>, <code>D21</code>, <code>D22</code>, and <code>D23</code> for your simulator projects. Analog pins include <code>D32</code> through <code>D35</code>.</span>
          </div>
          <div class="help-comp-card">
            <div class="help-comp-top"><span class="help-comp-icon">&#129744;</span><strong>Raspberry Pi Pico</strong></div>
            <span>Main board for <code>MicroPython (.py)</code> mode. Uses <code>GP</code> pins such as <code>GP0</code>, <code>GP1</code>, <code>GP2</code>. Analog-capable pins are <code>GP26</code>, <code>GP27</code>, and <code>GP28</code>. Only one Pico can be placed at a time.</span>
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
            <span>Required pins: <code>+</code> and <code>-</code>. Same wiring as Red LED. Commonly used for ready or success indicators in a circuit.</span>
          </div>
          <div class="help-comp-card">
            <div class="help-comp-top"><span class="help-comp-icon">&#128309;</span><strong>Blue LED</strong></div>
            <span>Required pins: <code>+</code> and <code>-</code>. Same wiring as other LEDs. Useful for signal or status indicators in your demo projects.</span>
          </div>
          <div class="help-comp-card">
            <div class="help-comp-top"><span class="help-comp-icon">&#128993;</span><strong>Yellow LED</strong></div>
            <span>Required pins: <code>+</code> and <code>-</code>. Same wiring as other LEDs. Commonly used for warning or transition states in a circuit.</span>
          </div>
        </div>

        <div class="help-comp-section-title">Sensors</div>
        <div class="help-comp-grid">
          <div class="help-comp-card">
            <div class="help-comp-top"><span class="help-comp-icon">&#128225;</span><strong>HC-SR04 Ultrasonic</strong></div>
            <span>Required pins: <code>VCC</code>, <code>Trig</code>, <code>Echo</code>, <code>GND</code>. Send a pulse to <code>Trig</code> and measure the duration on <code>Echo</code> using <code>pulseIn()</code>. Use the on-screen slider to simulate distance from <code>2</code> to <code>400 cm</code>.</span>
          </div>
          <div class="help-comp-card">
            <div class="help-comp-top"><span class="help-comp-icon">&#127777;</span><strong>DHT22 Temp &amp; Humidity</strong></div>
            <span>Required pins: <code>VCC</code>, <code>Data</code>, <code>GND</code>. The module artwork is drawn with the breakout-style <code>+</code>, <code>OUT</code>, <code>-</code> labels so it matches the real sensor body. Use the <code>DHT</code> library with <code>dht.readTemperature()</code> and <code>dht.readHumidity()</code>. In Pico/MicroPython mode, <code>dht.DHT22(Pin(x))</code> works only when the DHT part is actually placed on the canvas and <code>x</code> matches the Data wire. The simulator supports <code>measure()</code>, <code>temperature()</code>, and <code>humidity()</code> too. Adjust the temperature and humidity sliders on the canvas to change simulated values.</span>
          </div>
          <div class="help-comp-card">
            <div class="help-comp-top"><span class="help-comp-icon">&#128680;</span><strong>HC-SR501 PIR Motion Sensor</strong></div>
            <span>Required pins: <code>GND</code>, <code>OUT</code>, <code>VCC</code>. The on-canvas board is arranged left to right in that order to match the HC-SR501 module photo. In this simulator, <code>OUT</code> goes <code>HIGH</code> when motion is detected. Click the sensor dome on the canvas to toggle the motion state during simulation.</span>
          </div>
          <div class="help-comp-card">
            <div class="help-comp-top"><span class="help-comp-icon">&#127774;</span><strong>LDR Light Sensor</strong></div>
            <span>Required pins: <code>S</code>, <code>VCC</code>, <code>GND</code>. Read with <code>analogRead(pin)</code>. Higher values mean more light. Drag the on-screen slider up for bright and down for dark conditions.</span>
          </div>
          <div class="help-comp-card">
            <div class="help-comp-top"><span class="help-comp-icon">&#128280;</span><strong>Button</strong></div>
            <span>Required pins: <code>P1</code> and <code>P2</code>. In this simulator, <code>digitalRead()</code> returns <code>LOW</code> while the button is held and <code>HIGH</code> when released. Hold down the button on the canvas to keep it pressed.</span>
          </div>
          <div class="help-comp-card">
            <div class="help-comp-top"><span class="help-comp-icon">&#128433;</span><strong>Joystick (KY-023)</strong></div>
            <span>Required pins: <code>VCC</code>, <code>GND</code>, <code>VRX</code>, <code>VRY</code>, <code>SW</code>. Read <code>VRX</code> and <code>VRY</code> with <code>analogRead()</code> for axis values from <code>0</code> to <code>4095</code>. Click the joystick cap on the canvas to toggle the <code>SW</code> button state.</span>
          </div>
          <div class="help-comp-card">
            <div class="help-comp-top"><span class="help-comp-icon">&#127897;</span><strong>KY-004 Key Switch</strong></div>
            <span>Required pins: <code>S</code>, <code>VCC</code>, <code>GND</code>. In this simulator, <code>digitalRead()</code> returns <code>LOW</code> when pressed and <code>HIGH</code> when released. Click the cap on the canvas to toggle during simulation.</span>
          </div>
          <div class="help-comp-card">
            <div class="help-comp-top"><span class="help-comp-icon">&#128243;</span><strong>SW-420 Vibration Sensor</strong></div>
            <span>Required pins: <code>DO</code>, <code>GND</code>, <code>VCC</code>. In this simulator, <code>digitalRead()</code> returns <code>HIGH</code> when vibration is detected and <code>LOW</code> when stable. Click the sensor body on the canvas to toggle the vibration state.</span>
          </div>
          <div class="help-comp-card">
            <div class="help-comp-top"><span class="help-comp-icon">&#128293;</span><strong>Flame Sensor</strong></div>
            <span>Required pins: <code>AO</code>, <code>DO</code>, <code>GND</code>, <code>VCC</code>. In this simulator, <code>DO</code> goes <code>LOW</code> when flame is detected. Use <code>analogRead()</code> on <code>AO</code> for intensity. Click the sensor body or drag the analog slider to simulate flame presence.</span>
          </div>
          <div class="help-comp-card">
            <div class="help-comp-top"><span class="help-comp-icon">&#128680;</span><strong>KY-032 IR Obstacle</strong></div>
            <span>Required pins: <code>EN</code>, <code>VCC</code>, <code>OUT</code>, <code>GND</code>. In this simulator, <code>OUT</code> goes <code>LOW</code> when an obstacle is detected and <code>HIGH</code> when the path is clear. Click the sensor on the canvas to toggle obstacle detection.</span>
          </div>
        </div>

        <div class="help-comp-section-title">Peripherals</div>
        <div class="help-comp-grid">
          <div class="help-comp-card">
            <div class="help-comp-top"><span class="help-comp-icon">&#9881;</span><strong>Servo Motor</strong></div>
            <span>Required pins: <code>PWM</code>, <code>VCC</code>, <code>GND</code>. Control with the <code>Servo</code> library using <code>servo.write(angle)</code> where angle is <code>0</code> to <code>180</code>. The horn on the canvas rotates to show the current angle. Drag the on-screen slider to test manually.</span>
          </div>
          <div class="help-comp-card">
            <div class="help-comp-top"><span class="help-comp-icon">&#128276;</span><strong>Buzzer</strong></div>
            <span>Required pins: <code>+</code> and <code>-</code>. Use <code>tone(pin, frequency)</code> to play a sound and <code>noTone(pin)</code> to stop. You can also use <code>digitalWrite(pin, HIGH)</code> for a simple on/off beep. The buzzer icon changes when active.</span>
          </div>
          <div class="help-comp-card">
            <div class="help-comp-top"><span class="help-comp-icon">&#128223;</span><strong>OLED Display (SSD1306)</strong></div>
            <span>Required pins: <code>GND</code>, <code>VCC</code>, <code>SCL</code>, <code>SDA</code>. Use the <code>Adafruit_SSD1306</code> library to draw text and graphics. Connect <code>SCL</code> to <code>D22</code> and <code>SDA</code> to <code>D21</code> on ESP32. The simulated display updates live as your sketch runs.</span>
          </div>
        </div>

        <div class="help-tip">
          &#128161; <strong>Simulator tip:</strong> The output logic shown in each component card above reflects how this simulator behaves, not a universal rule. Real modules from different manufacturers may behave differently — always check the datasheet or test your physical module before assuming HIGH or LOW.
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
          <div class="help-shortcut-row"><div class="help-shortcut-keys">&#128204; Studio tab</div><div class="help-shortcut-label">Switch to canvas view — tap the Build Kit panel to add components</div></div>
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
            <div class="help-step-desc">For the best results, write simple MicroPython using one main <code>while True:</code> loop, one statement per line, and basic <code>if / elif / else</code> logic. Avoid advanced features such as <code>for</code> loops, classes, <code>try/except</code>, and complex helper functions unless you have tested them in this simulator.</div>
          </div>
        </div>

        <div class="help-step">
          <div class="help-step-badge">6</div>
          <div class="help-step-content">
            <div class="help-step-title">Use simulator-supported commands</div>
            <div class="help-step-desc">MicroPython support covers: <code>Pin</code>, <code>value()</code>, <code>ADC.read_u16()</code>, <code>PWM.freq()</code>, <code>PWM.duty_u16()</code>, <code>time.sleep()</code>, <code>time.sleep_ms()</code>, <code>time.sleep_us()</code>, <code>print()</code>, and <code>time_pulse_us()</code>. Arduino support follows built-in simulator functions and the included libraries.</div>
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
          &#128161; <strong>Quick reminder:</strong> If a reading always stays at <code>0</code>, first check the board mode, then check the exact pin numbers, then confirm that every required wire for that component is connected. If readings seem inverted, your physical module may use different output logic than what is shown in the simulator — check the datasheet for your specific module.
        </div>
      </div>

    </div>

    <div class="help-footer">
      <div class="help-footer-left">
        <span class="help-footer-brand">SensorsHub</span>
        <span class="help-footer-uni">University of Eastern Pangasinan</span>
      </div>
      <button class="btn green" onclick="closeHelp()">Got it &#10003;</button>
    </div>

  </div>
</div>
`;
