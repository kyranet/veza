<div align="center">

<img src="https://raw.githubusercontent.com/kyranet/veza/main/static/logo.png" height="200">

# Veza

[![Discord](https://discordapp.com/api/guilds/582495121698717696/embed.png)](https://discord.gg/pE5sfxK)
[![npm version](https://img.shields.io/npm/v/veza?color=crimson&logo=npm&style=flat-square)](https://www.npmjs.com/package/veza)
[![npm downloads](https://img.shields.io/npm/dt/veza?color=crimson&logo=npm&style=flat-square)](https://www.npmjs.com/package/veza)
[![lgtm](https://img.shields.io/lgtm/alerts/g/kyranet/veza.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/kyranet/veza/alerts/)
[![Patreon](https://img.shields.io/badge/donate-patreon-F96854.svg?logo=patreon)](https://donate.skyra.pw/patreon)

</div>

## About

**Veza** is a protocol that operates over either [IPC] or [TCP] with the only difference of one line of code to switch
between the two. Inspired on [node-ipc], it seeks to use modern, fast, and intuitive [API]s, as well as exposing all the
underlying back-ends for much higher customizability and extensibility, as well as a HTTP-like protocol where you can
send a message and optionally receive a response for it.

## Socket Support

-   [x] Unix Socket or Windows Socket.
-   [x] TCP Socket.
-   [ ] TLS Socket.
-   [ ] UDP Sockets.

> **TLS**: TLS sockets can be achieved by extending Veza to use SSL handshakes. To keep things simple and tidy, this is
> not shipped in core, but will be considered for future releases.

> **UDP**: UDP sockets are not supported due to Veza's requirement for messages to be reliably received in order.

[api]: https://en.wikipedia.org/wiki/Application_programming_interface
[ipc]: https://en.wikipedia.org/wiki/Inter-process_communication
[tcp]: https://en.wikipedia.org/wiki/Transmission_Control_Protocol
[node-ipc]: https://www.npmjs.com/package/node-ipc

## Messaging

All messages are encoded and decoded using [`binarytf`][binarytf], which allows a messages to be sent using the least
amount of bytes possible, increasing throughput; plus a 11-byte header at the start of each message. More information
available in [PROTOCOL].

[binarytf]: https://www.npmjs.com/package/binarytf
[protocol]: https://github.com/kyranet/veza/blob/master/PROTOCOL.md

## Documentation

All the documentation is available at [veza.js.org] and at [the wiki](https://github.com/kyranet/veza/wiki). You can
find examples of code [here](https://github.com/kyranet/veza/tree/master/examples).

[veza.js.org]: https://veza.js.org/

## Contributing

1. Fork it!
1. Create your feature branch: `git checkout -b my-new-feature`
1. Commit your changes: `git commit -am 'Add some feature'`
1. Push to the branch: `git push origin my-new-feature`
1. Submit a pull request!

## Author

**veza** © [kyranet][author], released under the
[MIT][license] License.
Authored and maintained by kyranet.

> Github [kyranet][author] - Twitter [@kyranet\_][twitter]

[license]: https://github.com/kyranet/veza/blob/master/LICENSE.md
[author]: https://github.com/kyranet
[twitter]: https://twitter.com/kyranet_
