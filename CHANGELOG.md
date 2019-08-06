# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

## 0.7.0

### Added
- Added more tests.
- Documented all the events.
- Added `veza.Server` and `veza.Client`.
- Added [CHANGELOG.md](https://github.com/kyranet/veza/blob/master/CHANGELOG.md).
- Added [SECURITY.md](https://github.com/kyranet/veza/blob/master/SECURITY.md).
- Added [PROTOCOL.md](https://github.com/kyranet/veza/blob/master/PROTOCOL.md).
- Added documentation page, available at [veza.js.org](https://veza.js.org).

### Changed
- Simplified event names to be more intuitive and easier to use.
- Revamped queue to use the old message split method from `veza@0.5.0`.
- Updated spec to re-include `ByteLength` into the headers.
- Document more things as private to not show in the documentation.
- Modified `Server#serve`'s return from `undefined` to `this`.

### Removed
- Removed `veza.Node` in favor of `veza.Server` and `veza.Client`.

### Fixed
- Resolved bug from 0.6.0 where the queue was getting into data racing on extremely edge cases.

## 0.6.0

- *Written more tests.*
- *Coverage 100%.*
- *Written **more** tests.*
- *And also added a shiny 100% coverage badge.*

### Added
- Added `handshakeTimeout` option in `Node`.
- Added more typings.
- Added more documentation.
- Added `socket.connecting`, `socket.connect`, `socket.destroy`, `socket.ready`, `socket.connect`, and `socket.ready`.

### Changed
- `Node#connectTo` does not longer take an argument for the socket's `name`, also called "label". The name is now the socket's.

### Removed
- `Infinity` is not longer an option in timeouts nor retry limits, refer to `-1` for the same behaviour.
- Removed `Queue#name` and `Queue#socket`. They're unnecessary getters.

### Fixed
- Fixed any possible outcome of an HTTP server or client being able to crash a Veza server or socket.
- Fixed reconnections not identifying correctly.

## 0.5.0

### Added
- Added Test Suite (https://github.com/kyranet/veza/issues/9).
- Disconnect previous node if there was one named the same (https://github.com/kyranet/veza/issues/12).

### Changed
- Rewritten Veza to Strict TypeScript (https://github.com/kyranet/veza/issues/13).
- Nullify the socket when destroyed.

### Fixed
- Fixed "Cannot read property delete of undefined".
