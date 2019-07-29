# Veza Protocol

The Veza protocol operates on a two-way long-polling TCP request with binary transfers only. This document explains how
this protocol works and how must be implemented.

## Structure

The structure is divided in two key components: the `Server` and the `Client`, the server `open`s a `IPC`/`TCP` server
and may `close` it eventually, while a `Client` can connect to and disconnect from them, whether Veza uses `IPC` or
`IPC` is based on where the server is opened to, typically if a numeric port or an IP is passed, it will use `TCP`, and
`IPC` when a path to a socket file is passed instead.

Furthermore each `Client` has a collection of sockets used to send messages to the servers it's connected to, named
`ClientSocket`s, and each `Server` has a collection of sockets used to send messages to the clients connected to it,
named `ServerSocket`.

Assuming the server runs on `TCP` with the port `8002`, the connection would be something like the following:

```java
┌────────┐                              ┌────────┐
│ Server │         ClientSocket         │ Client │
├────────┤ ←--------------------------- ├────────┤
│  8002  │         ServerSocket         │  8002  │
└────────┘ ---------------------------→ └────────┘
```

> `ClientSocket` allows Client to send messages to Server, and `ServerSocket` allows Server to send messages to Client.

However, multiple clients can connect to a server just fine.

```java
┌────────┐      ┌────────┐      ┌────────┐
│ Client │  CS  │ Server │  CS  │ Client │
├────────┤ ---→ ├────────┤ ←--- ├────────┤
│  8002  │  SS  │  8002  │  SS  │  8002  │
└────────┘ ←--- └────────┘ ---→ └────────┘
                  ↑    |
               CS |    | SS
                  |    ↓
                ┌────────┐
                │ Client │
                ├────────┤
                │  8002  │
                └────────┘
```

> `CS` and `SS` refer to `ClientSocket` and `ServerSocket`, respectively.

## Communication

Veza uses binary-encoded messages to communicate between all sockets, to do so, it uses [Binary Term Format][binarytf]
to encode messages before sending them, and all the communication happens in `ClientSocket` and in `ServerSocket`
exclusively, since they define a socket connection.

Each socket is a [duplex][] connection, so they have both a message sender and a receiver. The composition of messages
using the Veza protocol is the following:

| ID      | Receptive | Byte-Length | Bytes ...           |
| :-----: | :-------: | :---------: | :-----------------: |
| 6 bytes | 1 byte    | 4 bytes     | `Byte-Length` bytes |

1. Implementation-wise there is no restriction about what `ID` may be, it can be a [Cryptographic Nonce][crypto_nonce],
it may be an incremental number, it may be anything, as long as two messages from the same sender do not conflict and is
strictly 6 bytes long.
1. `Receptive` header defines whether the message is `read-only` or the server is awaiting its response,
will always be `0x00` for non-receptive, or `0x01` for receptive.
1. `Byte-Length` is used to define how long the message is in bytes.
1. `Bytes` is the message encoded with [Binary Term Format][binarytf].

When a message is receptive, it must be replied **with the same ID**, this will help the sender identify the original
message and resolve the value (like a `HTTP GET` would work, where you give the URL and you get the response from the
request).

### Notes

It is suggested to make a queue receiver to handle the messages, Veza takes advantage of TCP's buffering nature, which
helps lowering the latency and the time it takes to send the messages, which can also mean that two or more messages
may be received glued up; use the `Byte-Length` header to find the end of the message (and the start of the next), and
it also may be received partial ─ most routers allow up to 65536 bytes in a segment, so when sending large messages (for
example files), it is suggested to implement a buffer control to join all the segments once it is received full.

## Connection

The connection between the `Client` and the `Server` is done over TCP but has an extra step: **handshake**.

The handshake has two purposes:

- **Verify**: This step helps identifying if the counterpart "understands" the same language. The slight decode error or
type mismatch should end on a prompt disconnection.
- **Identify**: Veza nodes have a name for which they are identified as. For example if a `Server` is named `master`,
all `Server`s connected to it may send messages to it using `master` as its name.

```java
// Stablish a TCP connection by connecting Client
// to Server.
┌────────┐                              ┌────────┐
│ Server │                              │ Client │
├────────┤        TCP Connection        ├────────┤
│ master │ ←--------------------------→ │ socket │
│  8002  │                              │  8002  │
└────────┘                              └────────┘

// Once the connection has stablished, the server
// will send its name ('master') to the client.
┌────────┐                              ┌────────┐
│ Server │           "master"           │ Client │
├────────┤ ---------------------------→ ├────────┤
│ master │                              │ socket │
│  8002  │                              │  8002  │
├────────┤                              ├────────┤
│ ?????? │                              │ ?????? │
└────────┘                              └────────┘

// The client must reply with its name ('socket')
// to the server.
┌────────┐                              ┌────────┐
│ Server │                              │ Client │
├────────┤                              ├────────┤
│ master │                              │ socket │
│  8002  │           "socket"           │  8002  │
├────────┤ ←--------------------------- ├────────┤
│ socket │                              │ ?????? │
└────────┘                              └────────┘

// Now both nodes "know" each others names and the
// connection has successfully verified. Now you
// may send messages from the Server to the Client
// using "socket", or vice versa using "master".
┌────────┐                              ┌────────┐
│ Server │                              │ Client │
├────────┤                              ├────────┤
│ master │                              │ socket │
│  8002  │                              │  8002  │
├────────┤                              ├────────┤
│ socket │                              │ master │
└────────┘                              └────────┘
```

[binarytf]: https://github.com/binarytf
[duplex]: https://en.wikipedia.org/wiki/Duplex_(telecommunications)
[crypto_nonce]: https://en.wikipedia.org/wiki/Cryptographic_nonce
