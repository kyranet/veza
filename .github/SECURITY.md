# Security

## General Statement

Veza is a minimal protocol made on top of the `IPC` and `TCP` protocols (see [PROTOCOL][]), it lacks of cryptography and
security like [TLS][] when using the `TCP` protocol.

## Ports

In most operating systems, ports are exposed not only in `localhost`, but also outside the server, this can mean a large
security hole if Veza handles sensitive information between processes and/or microservices.

If your Veza server is only supposed to run only in its local machine, we strongly suggest using a **[Firewall][]** like
`iptables` for Linux ─ For example, considering `XXXX` is your port, you would need to run the following commands:

```bash
# Allow access to the XXXX port in localhost
$ iptables -A INPUT -p tcp -s localhost --dport XXXX -j ACCEPT
```

```bash
# Deny access to the XXXX port elsewhere
$ iptables -A INPUT -p tcp --dport XXXX -j DROP
```

> The `iptables` command is a _root-only_ command, if you are not using root but a [sudoer][] account, you might need to
> use `sudo`.

Inside containers like [Docker][] or equivalents, this can be unnecessary, since the ports are not exposed by default.

For Windows users, SpiceWorks has a [nice guide][windowsfirewall] about this process.

## Handshakes

If your Veza server connects with other machines, this changes a little more ─ you can whitelist the other machines' IPs
with `iptables` (besides `localhost` itself) or implement **an additional handshake**.

Additional handshakes can be made by sending a message from the Server to the Client (or vice versa) and compare certain
values, for example an unique key. This approach may take security approaches such as encrypting the "authenticate"
payload with a special key and adding a timer to avoid [man-in-the-middle attacks][maninthemiddle], as they usually have
latency implications.

## Messages

There are many techniques that can be used to enhance security between Veza nodes on the public network, involving a
little cryptography with it. Some of the most common techniques can include:

-   Send the content and a [MD5][] hash of it, this is exposes the contents but can protect nodes from malicious contents
    or requests ─ if the content does not generate the same hash as the from the message, the message is invalid. This
    approach is very simple but also very efective.
-   [Public-key cryptography][publickeycryptography], this approach is one of the fundamental security ingredients in
    modern [cryptosystems][], applications and protocols assuring the confidentiality, authenticity and non-repudiability of
    electronic communications and data storage, it is more complex than the previous approach but does not expose the
    messages contents.

[protocol]: ./PROTOCOL.md
[tls]: https://en.wikipedia.org/wiki/Transport_Layer_Security
[firewall]: https://en.wikipedia.org/wiki/Firewall_(computing)
[sudoer]: https://help.ubuntu.com/community/Sudoers
[docker]: https://www.docker.com/
[windowsfirewall]: https://community.spiceworks.com/how_to/159244-block-or-allow-tcp-ip-port-in-windows-firewall
[maninthemiddle]: https://en.wikipedia.org/wiki/Man-in-the-middle_attack
[md5]: https://en.wikipedia.org/wiki/MD5
[publickeycryptography]: https://en.wikipedia.org/wiki/Public-key_cryptography
[cryptosystems]: https://en.wikipedia.org/wiki/Cryptosystem
