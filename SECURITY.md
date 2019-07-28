# Security

Veza is a minimal protocol made on top of the `IPC` and `TCP` protocols (see [PROTOCOL][]), it lacks of cryptography and
security like [TLS][] when using the `TCP` protocol.

In most operating systems, ports are exposed not only in localhost, but also outside the server, this can mean a large
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

> The `iptables` command is a *root-only* command, if you are not using root but a [sudoer][] account, you might need to
use `sudo`.

Inside containers like [Docker][] or equivalents, this can be unnecessary, since the ports are not exposed by default.

However, if your Veza server connects with other machines, this changes a little more ─ you can whitelist the other
machines' IPs with `iptables` (besides `localhost` itself) or implement **an additional handshake**.

Additional handshakes can be made by sending a message from the Server to the Client (or vice versa) and compare certain
values, for example an unique key. This approach may take security approaches such as encrypting the "authenticate"
payload with a special key and adding a timer to avoid [man-in-the-middle attacks][ManInTheMiddle], as they usually have
latency implications.

[PROTOCOL]: ./PROTOCOL.md
[TLS]: https://en.wikipedia.org/wiki/Transport_Layer_Security
[Firewall]: https://en.wikipedia.org/wiki/Firewall_(computing)
[sudoer]: https://help.ubuntu.com/community/Sudoers
[Docker]: https://www.docker.com/
[ManInTheMiddle]: https://en.wikipedia.org/wiki/Man-in-the-middle_attack
