# SensorsHub Simulator

SensorsHub is a browser-based learning simulator for building and testing beginner electronics projects with ESP32 and Raspberry Pi Pico boards. It is designed for classroom practice, quick experiments, and debugging circuit logic before moving to physical hardware.

## What it does

- Build circuits by dragging boards, sensors, lights, buttons, displays, motors, and other components onto the canvas.
- Connect component pins with the Wire tool.
- Automatically route wires around components and preview a wire route while dragging.
- Move, bend, delete, and undo wiring changes.
- Search and organize components by category.
- Write and run beginner Arduino-style or MicroPython-style sketches.
- Simulate common inputs and outputs, including LEDs, buttons, analog values, distance, temperature, humidity, displays, servos, buzzers, and serial interaction.
- See wiring warnings when required power, ground, or signal connections are missing.
- Save a project to a file and load it again later.
- Use the built-in Help panel for wiring instructions, component behavior, examples, and troubleshooting.

## Getting started

1. Open `index.html` in a modern browser, or serve this folder with any simple static web server.
2. Choose a board mode from the Studio interface.
3. Open the component palette and drag parts onto the canvas.
4. Select the Wire tool and connect the required pins, including VCC and GND where needed.
5. Open the Code panel, choose Arduino or MicroPython, and enter a sketch.
6. Run the simulation and interact with supported components on the canvas.

## Project structure

| File | Purpose |
| --- | --- |
| `index.html` | Main application layout, menus, editor, and project save/load actions |
| `style.css` | Application styling and responsive interface layout |
| `components.js` | Component definitions, palette behavior, placement, and component state |
| `drawing.js` | Canvas rendering, wires, previews, and visual interaction |
| `interaction.js` | Selection, dragging, wiring, editing, and keyboard interaction |
| `simulator.js` | Sketch execution and simulated component behavior |
| `LibraryRegistry.js` | Board and library metadata used by the simulator |
| `helpTemplate.js` | Built-in help, wiring guidance, and component documentation |
| `libraries/` | Supporting library files and simulator resources |

## Important note

SensorsHub is an educational prototype. Its simulated behavior is intentionally focused on common beginner projects and may not exactly match every real module or board. Always check the physical component datasheet and test the final project on real ESP32 or Pico hardware before relying on it.

## Deployment

This is a static web application and can be deployed to Vercel, GitHub Pages, or another static hosting service. The deployment should use the repository's `main` branch and serve the project root, where `index.html` is located.

## Credits

SensorsHub Simulator — University of Eastern Pangasinan.

