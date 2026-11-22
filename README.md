# Transit Tracker Configurator

![](screenshot.jpg)

This fork configures Transit Tracker displays for Lyon: each row of the display shows either a TCL line at a stop (next departure) or a Vélo'v station (free docks and bikes). It talks to the [Transit Tracker Lyon API](https://github.com/tiralmos/transit-tracker-lyon-api) and flashes the firmware from [tiralmos/transit-tracker-lyon-firmware](https://github.com/tiralmos/transit-tracker-lyon-firmware). Run it with Docker from the API's `deploy/tcl-velov` stack.

The original description: this is the source for the web-based UI used to configure [Transit Tracker](https://transit-tracker.eastsideurbanism.org/) devices. It's made with SvelteKit and has an incredible amount of tech debt and spaghetti. It should probably be rewritten from scratch to be more maintainable and easier to reason about, but who knows when I'll have the time to do that.

Have fun.

## License

```
MIT License

Copyright (c) 2026 TJ Horner

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
