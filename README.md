# Veza <img src="https://github.com/kyranet/veza/blob/master/static/logo.png?raw=true" align="right" width="30%">

<div align="center">
	<p>
		<a href="https://discord.gg/pE5sfxK">
			<img src="https://discordapp.com/api/guilds/582495121698717696/embed.png" alt="Discord" />
		</a>
		<a href="https://www.npmjs.com/package/veza">
			<img src="https://img.shields.io/npm/v/veza.svg?maxAge=3600" alt="NPM version" />
		</a>
		<a href="https://www.npmjs.com/package/veza">
			<img src="https://img.shields.io/npm/dt/veza.svg?maxAge=3600" alt="NPM downloads" />
		</a>
		<a href="https://dev.azure.com/kyranet/kyranet.public/_build/latest?definitionId=9&branchName=master">
			<img src="https://dev.azure.com/kyranet/kyranet.public/_apis/build/status/kyranet.veza?branchName=master" alt="Build status" />
		</a>
		<a href="https://dev.azure.com/kyranet/kyranet.public/_build/latest?definitionId=9&branchName=master">
			<img src="https://img.shields.io/azure-devops/coverage/kyranet/kyranet.public/9/master.svg" alt="Azure DevOps coverage">
		</a>
		<a href="https://lgtm.com/projects/g/kyranet/veza/alerts/">
			<img src="https://img.shields.io/lgtm/alerts/g/kyranet/veza.svg?logo=lgtm&logoWidth=18" alt="Total alerts">
		</a>
		<a href="https://dependabot.com">
			<img src="https://api.dependabot.com/badges/status?host=github&repo=kyranet/veza" alt="Dependabot Status">
		</a>
		<a href="https://www.patreon.com/kyranet">
			<img src="https://img.shields.io/badge/donate-patreon-F96854.svg" alt="Patreon" />
		</a>
	</p>
	<p>
		<a href="https://nodei.co/npm/veza/"><img src="https://nodei.co/npm/veza.png?downloads=true&stars=true" alt="npm installnfo" /></a>
	</p>
</div>

## About

**Veza** is a lower level version of [IPC-Link](https://github.com/kyranet/ipc-link)
that is lightning fast and operates with raw buffers as opposed to sending buffered
stringified `JSON` objects. This library has [`binarytf`][binarytf] as the only
dependency, which serves for fast and compact message serialization and deserialization,
while using built-in modules (`net`, `events`...) to do the IPC / TCP operations.

In Veza, you have "nodes", which can either create a server (and receive messages)
or connect to other servers, even both at the same time. Additionally, you have
`client.send(data);` which will wait for the socket to reply back.

> One of Veza's special features is the ability to glue truncated messages and split
concatenated messages, for which it uses a delimiter detection from [`binarytf`][binarytf]
to find where messages end at and where the next continues. Furthermore, it prepends a
compressed 7-bit header for id matching and the receptivity of the message.

## Examples

All examples are written in TypeScript and are available [here](https://github.com/kyranet/veza/tree/master/examples).

## Contributing

1. Fork it!
1. Create your feature branch: `git checkout -b my-new-feature`
1. Commit your changes: `git commit -am 'Add some feature'`
1. Push to the branch: `git push origin my-new-feature`
1. Submit a pull request!

## Author

**veza** © [kyranet](https://github.com/kyranet), released under the
[MIT](https://github.com/kyranet/veza/blob/master/LICENSE) License.
Authored and maintained by kyranet.

> Github [kyranet](https://github.com/kyranet) - Twitter [@kyranet_](https://twitter.com/kyranet_)

[binarytf]: https://www.npmjs.com/package/binarytf
